#!/usr/bin/env node
/**
 * admin.js — local content editor for the portfolio.
 *
 * Run:  node admin.js
 * Then open http://localhost:5051
 *
 * No npm install needed (built-in modules only). This does NOT touch git —
 * after saving, just `git add -A && git commit -m "..." && git push` as usual.
 *
 * What it does:
 *  - Lists existing projects/blogs (from content/index.json)
 *  - Lets you create a new project/blog or edit an existing one via a form
 *  - Handles file uploads (image/video/doc) and writes them into the
 *    correct content/<section>/<slug>/ folder
 *  - Writes meta.json for you
 *  - Re-runs build-index.js automatically after every save/delete
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, 'content');
const PORT = process.env.PORT || 5051;

// ── helpers ──────────────────────────────────────────────

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';
}

function sanitizeFilename(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function runBuildIndex() {
  try {
    const out = execFileSync('node', ['build-index.js'], { cwd: ROOT, encoding: 'utf8' });
    return { ok: true, log: out };
  } catch (e) {
    return { ok: false, log: (e.stdout || '') + (e.stderr || e.message) };
  }
}

function readIndex() {
  const idxPath = path.join(CONTENT_DIR, 'index.json');
  if (!fs.existsSync(idxPath)) return { projects: [], blogs: [] };
  try {
    return JSON.parse(fs.readFileSync(idxPath, 'utf8'));
  } catch {
    return { projects: [], blogs: [] };
  }
}

function listExistingFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f !== 'meta.json');
}

// ── multipart/form-data parsing (no deps) ───────────────

function parseMultipart(buffer, boundary) {
  const delimiter = Buffer.from('--' + boundary);
  const parts = [];
  let pos = buffer.indexOf(delimiter);
  while (pos !== -1) {
    const nextPos = buffer.indexOf(delimiter, pos + delimiter.length);
    if (nextPos === -1) break;
    let partBuf = buffer.slice(pos + delimiter.length, nextPos);
    pos = nextPos;

    if (partBuf.length < 4) continue;
    if (partBuf[0] === 0x0d && partBuf[1] === 0x0a) partBuf = partBuf.slice(2);

    const headerEndMarker = Buffer.from('\r\n\r\n');
    const headerEnd = partBuf.indexOf(headerEndMarker);
    if (headerEnd === -1) continue;

    const headerStr = partBuf.slice(0, headerEnd).toString('utf8');
    let body = partBuf.slice(headerEnd + 4);
    if (body.length >= 2 && body[body.length - 2] === 0x0d && body[body.length - 1] === 0x0a) {
      body = body.slice(0, body.length - 2);
    }

    const headers = {};
    headerStr.split('\r\n').forEach(line => {
      const idx = line.indexOf(':');
      if (idx > -1) headers[line.slice(0, idx).toLowerCase()] = line.slice(idx + 1).trim();
    });

    const cd = headers['content-disposition'] || '';
    const nameMatch = cd.match(/name="([^"]*)"/);
    const filenameMatch = cd.match(/filename="([^"]*)"/);

    parts.push({
      name: nameMatch ? nameMatch[1] : null,
      filename: filenameMatch ? filenameMatch[1] : null,
      contentType: headers['content-type'] || null,
      data: body,
    });
  }
  return parts;
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

// ── route handlers ───────────────────────────────────────

async function handleList(req, res) {
  sendJSON(res, 200, readIndex());
}

async function handleGet(req, res, query) {
  const { section, slug } = query;
  if (!section || !slug) return sendJSON(res, 400, { error: 'section and slug required' });
  const dir = path.join(CONTENT_DIR, section, slug);
  const metaPath = path.join(dir, 'meta.json');
  if (!fs.existsSync(metaPath)) return sendJSON(res, 404, { error: 'not found' });
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const files = listExistingFiles(dir);
  sendJSON(res, 200, { meta, files });
}

async function handleSave(req, res) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  if (!boundaryMatch) return sendJSON(res, 400, { error: 'expected multipart/form-data' });
  const boundary = boundaryMatch[1] || boundaryMatch[2];

  const raw = await collectBody(req);
  const parts = parseMultipart(raw, boundary);

  const fields = {};
  const files = []; // { fieldName, filename, data }
  for (const p of parts) {
    if (!p.name) continue;
    if (p.filename) {
      files.push({ fieldName: p.name, filename: p.filename, data: p.data });
    } else {
      fields[p.name] = p.data.toString('utf8');
    }
  }

  const section = fields.section === 'blogs' ? 'blogs' : 'projects';
  const title = (fields.title || '').trim();
  if (!title) return sendJSON(res, 400, { error: 'title is required' });

  const isEdit = fields.isEdit === 'true';
  const slug = isEdit ? fields.slug : slugify(fields.slug || title);
  const dir = path.join(CONTENT_DIR, section, slug);
  ensureDir(dir);

  let blocksMeta;
  try {
    blocksMeta = JSON.parse(fields.blocksMeta || '[]');
  } catch {
    return sendJSON(res, 400, { error: 'invalid blocksMeta JSON' });
  }

  const finalBlocks = blocksMeta.map((b, i) => {
    if (b.type === 'text') {
      return { type: 'text', content: b.content || '' };
    }
    // media block: image / video / doc
    const fileField = `file_${i}`;
    const uploaded = files.find(f => f.fieldName === fileField);
    let src = b.existingSrc || '';
    if (uploaded && uploaded.filename) {
      const safeName = sanitizeFilename(uploaded.filename);
      fs.writeFileSync(path.join(dir, safeName), uploaded.data);
      src = safeName;
    }
    const block = { type: b.type, src };
    if (b.caption) block.caption = b.caption;
    return block;
  });

  const tags = (fields.tags || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  const meta = {
    title,
    startDate: fields.startDate || '',
    endDate: fields.endDate || '',
    tags,
    description: fields.description || '',
    blocks: finalBlocks,
  };

  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  const build = runBuildIndex();
  sendJSON(res, 200, { ok: true, slug, section, build });
}

async function handleDelete(req, res) {
  const raw = await collectBody(req);
  let body;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return sendJSON(res, 400, { error: 'invalid JSON' });
  }
  const { section, slug } = body;
  if (!section || !slug) return sendJSON(res, 400, { error: 'section and slug required' });
  const dir = path.join(CONTENT_DIR, section, slug);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  const build = runBuildIndex();
  sendJSON(res, 200, { ok: true, build });
}

// ── frontend (single page) ───────────────────────────────

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>content admin</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#080808;--bg2:#0e0e0e;--bg3:#141414;--text:#e2e2e2;--text-dim:#666;--border:#1e1e1e;--accent:#b0b0b0;--ok:#5fae6b;--err:#c0605f;}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.6;}
#app{display:flex;height:100vh;}
#sidebar{width:280px;flex-shrink:0;border-right:1px solid var(--border);overflow-y:auto;padding:16px;}
#sidebar h2{font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;margin:18px 0 8px;}
#sidebar h2:first-child{margin-top:0;}
.item{display:flex;align-items:center;justify-content:space-between;padding:7px 8px;border:1px solid var(--border);background:var(--bg2);margin-bottom:6px;cursor:pointer;}
.item:hover{border-color:#333;}
.item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;}
.item button{background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:13px;padding:2px 6px;}
.item button:hover{color:var(--err);}
.newbtn{display:block;width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);color:var(--accent);cursor:pointer;font-family:inherit;font-size:12px;margin-bottom:4px;text-align:left;}
.newbtn:hover{border-color:#444;}
#main{flex:1;overflow-y:auto;padding:28px 36px;}
label{display:block;font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin:16px 0 6px;}
label:first-of-type{margin-top:0;}
input[type=text],input[type=month],textarea,select{width:100%;background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:8px 10px;font-family:inherit;font-size:13px;}
textarea{min-height:70px;resize:vertical;}
input:focus,textarea:focus,select:focus{outline:none;border-color:#444;}
.row{display:flex;gap:12px;}
.row > div{flex:1;}
.block{border:1px solid var(--border);background:var(--bg2);padding:14px;margin-bottom:10px;}
.block-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
.block-head select{width:auto;flex-shrink:0;}
.block-actions{display:flex;gap:6px;}
.block-actions button{background:none;border:1px solid var(--border);color:var(--text-dim);cursor:pointer;padding:3px 8px;font-family:inherit;font-size:11px;}
.block-actions button:hover{color:var(--text);border-color:#444;}
.existing-file{font-size:11px;color:var(--text-dim);margin-top:4px;}
.addblockbar{display:flex;gap:8px;margin:14px 0;}
.addblockbar button{flex:1;background:var(--bg3);border:1px solid var(--border);color:var(--accent);cursor:pointer;padding:8px;font-family:inherit;font-size:11px;}
.addblockbar button:hover{border-color:#444;}
#savebar{display:flex;align-items:center;gap:14px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);}
#savebar button{background:var(--bg3);border:1px solid var(--accent);color:var(--accent);cursor:pointer;padding:10px 22px;font-family:inherit;font-size:12px;letter-spacing:0.04em;}
#savebar button:hover{background:var(--accent);color:var(--bg);}
#status{font-size:12px;}
#status.ok{color:var(--ok);}
#status.err{color:var(--err);}
h1{font-size:14px;color:var(--accent);letter-spacing:0.04em;margin-bottom:4px;}
.sub{font-size:11px;color:var(--text-dim);margin-bottom:18px;}
pre{background:var(--bg2);border:1px solid var(--border);padding:10px;font-size:11px;color:var(--text-dim);overflow-x:auto;margin-top:10px;white-space:pre-wrap;}
.empty{font-size:11px;color:var(--text-dim);padding:6px 8px;}
</style>
</head>
<body>
<div id="app">
  <div id="sidebar">
    <button class="newbtn" onclick="newEntry('projects')">+ new project</button>
    <button class="newbtn" onclick="newEntry('blogs')">+ new blog</button>
    <h2>Projects</h2>
    <div id="list-projects"></div>
    <h2>Blogs</h2>
    <div id="list-blogs"></div>
  </div>
  <div id="main">
    <h1 id="formTitle">+ new project</h1>
    <div class="sub" id="formSub">fill in the fields, add blocks, save. files get copied automatically.</div>

    <input type="hidden" id="section" value="projects">
    <input type="hidden" id="isEdit" value="false">
    <input type="hidden" id="origSlug" value="">

    <label>Title</label>
    <input type="text" id="title" placeholder="6-DOF Robotic Arm">

    <div class="row">
      <div>
        <label>Slug (folder name / URL)</label>
        <input type="text" id="slug" placeholder="auto from title">
      </div>
    </div>

    <div class="row">
      <div>
        <label>Start date</label>
        <input type="month" id="startDate">
      </div>
      <div>
        <label>End date (leave blank if ongoing)</label>
        <input type="month" id="endDate">
      </div>
    </div>

    <label>Tags (comma separated)</label>
    <input type="text" id="tags" placeholder="Robotics, C++, ROS2">

    <label>Description (one sentence, shown on cards)</label>
    <textarea id="description" style="min-height:50px"></textarea>

    <label style="margin-top:24px;">Blocks</label>
    <div id="blocks"></div>
    <div class="addblockbar">
      <button onclick="addBlock('text')">+ text</button>
      <button onclick="addBlock('image')">+ image</button>
      <button onclick="addBlock('video')">+ video</button>
      <button onclick="addBlock('doc')">+ doc</button>
    </div>

    <div id="savebar">
      <button onclick="save()">save</button>
      <span id="status"></span>
    </div>
    <pre id="buildlog" style="display:none;"></pre>
  </div>
</div>

<script>
let blocks = []; // {type, content, caption, existingSrc, file}

function blockHTML(b, i) {
  let inner = '';
  if (b.type === 'text') {
    inner = '<textarea oninput="blocks['+i+'].content=this.value">' + escapeHtml(b.content||'') + '</textarea>';
  } else {
    inner = '<input type="file" onchange="blocks['+i+'].file=this.files[0]">';
    if (b.existingSrc) {
      inner += '<div class="existing-file">current file: ' + escapeHtml(b.existingSrc) + ' (leave empty to keep it)</div>';
    }
    inner += '<label style="margin-top:8px;">Caption (optional)</label><input type="text" value="' + escapeHtml(b.caption||'') + '" oninput="blocks['+i+'].caption=this.value">';
  }
  return '<div class="block">' +
    '<div class="block-head">' +
      '<select onchange="blocks['+i+'].type=this.value; render()">' +
        ['text','image','video','doc'].map(t => '<option value="'+t+'"'+(t===b.type?' selected':'')+'>'+t+'</option>').join('') +
      '</select>' +
      '<div class="block-actions">' +
        '<button onclick="moveBlock('+i+',-1)">↑</button>' +
        '<button onclick="moveBlock('+i+',1)">↓</button>' +
        '<button onclick="removeBlock('+i+')">remove</button>' +
      '</div>' +
    '</div>' + inner +
  '</div>';
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function render() {
  document.getElementById('blocks').innerHTML = blocks.map(blockHTML).join('') || '<div class="empty">no blocks yet</div>';
}

function addBlock(type) {
  blocks.push(type === 'text' ? {type:'text', content:''} : {type, caption:'', existingSrc:'', file:null});
  render();
}
function removeBlock(i){ blocks.splice(i,1); render(); }
function moveBlock(i, dir){
  const j = i + dir;
  if (j < 0 || j >= blocks.length) return;
  [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  render();
}

function newEntry(section) {
  document.getElementById('section').value = section;
  document.getElementById('isEdit').value = 'false';
  document.getElementById('origSlug').value = '';
  document.getElementById('title').value = '';
  document.getElementById('slug').value = '';
  document.getElementById('startDate').value = '';
  document.getElementById('endDate').value = '';
  document.getElementById('tags').value = '';
  document.getElementById('description').value = '';
  blocks = [];
  render();
  document.getElementById('formTitle').textContent = '+ new ' + (section === 'blogs' ? 'blog' : 'project');
  document.getElementById('status').textContent = '';
  document.getElementById('buildlog').style.display = 'none';
}

async function editEntry(section, slug) {
  const r = await fetch('/api/get?section='+section+'&slug='+encodeURIComponent(slug));
  if (!r.ok) { alert('failed to load'); return; }
  const { meta } = await r.json();
  document.getElementById('section').value = section;
  document.getElementById('isEdit').value = 'true';
  document.getElementById('origSlug').value = slug;
  document.getElementById('title').value = meta.title || '';
  document.getElementById('slug').value = slug;
  document.getElementById('startDate').value = meta.startDate || '';
  document.getElementById('endDate').value = meta.endDate || '';
  document.getElementById('tags').value = (meta.tags||[]).join(', ');
  document.getElementById('description').value = meta.description || '';
  blocks = (meta.blocks||[]).map(b => b.type === 'text'
    ? {type:'text', content:b.content||''}
    : {type:b.type, caption:b.caption||'', existingSrc:b.src||'', file:null});
  render();
  document.getElementById('formTitle').textContent = 'edit: ' + (meta.title||slug);
  document.getElementById('status').textContent = '';
  document.getElementById('buildlog').style.display = 'none';
  window.scrollTo(0,0);
}

async function deleteEntry(section, slug, ev) {
  ev.stopPropagation();
  if (!confirm('Delete "'+slug+'"? This removes the folder and all its files.')) return;
  const r = await fetch('/api/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({section, slug}) });
  if (r.ok) { loadList(); } else { alert('delete failed'); }
}

async function loadList() {
  const r = await fetch('/api/list');
  const data = await r.json();
  const render1 = (arr, section) => {
    if (!arr.length) return '<div class="empty">none yet</div>';
    return arr.map(item =>
      '<div class="item" onclick="editEntry(\\''+section+'\\',\\''+item.slug+'\\')">' +
        '<span>'+escapeHtml(item.title||item.slug)+'</span>' +
        '<button onclick="deleteEntry(\\''+section+'\\',\\''+item.slug+'\\',event)">×</button>' +
      '</div>'
    ).join('');
  };
  document.getElementById('list-projects').innerHTML = render1(data.projects||[], 'projects');
  document.getElementById('list-blogs').innerHTML = render1(data.blogs||[], 'blogs');
}

async function save() {
  const statusEl = document.getElementById('status');
  statusEl.className = ''; statusEl.textContent = 'saving...';

  const fd = new FormData();
  fd.append('section', document.getElementById('section').value);
  fd.append('isEdit', document.getElementById('isEdit').value);
  fd.append('slug', document.getElementById('isEdit').value === 'true'
    ? document.getElementById('origSlug').value
    : (document.getElementById('slug').value || document.getElementById('title').value));
  fd.append('title', document.getElementById('title').value);
  fd.append('startDate', document.getElementById('startDate').value);
  fd.append('endDate', document.getElementById('endDate').value);
  fd.append('tags', document.getElementById('tags').value);
  fd.append('description', document.getElementById('description').value);

  const blocksMeta = blocks.map((b, i) => {
    if (b.type === 'text') return { type:'text', content:b.content||'' };
    if (b.file) fd.append('file_'+i, b.file, b.file.name);
    return { type:b.type, caption:b.caption||'', existingSrc:b.existingSrc||'' };
  });
  fd.append('blocksMeta', JSON.stringify(blocksMeta));

  try {
    const r = await fetch('/api/save', { method:'POST', body: fd });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      statusEl.className = 'err'; statusEl.textContent = 'error: ' + (data.error || 'unknown');
      return;
    }
    statusEl.className = 'ok'; statusEl.textContent = 'saved ✓ (' + data.section + '/' + data.slug + ') — now git add/commit/push to publish';
    const logEl = document.getElementById('buildlog');
    logEl.style.display = 'block';
    logEl.textContent = data.build.log || '(no build output)';
    loadList();
  } catch (e) {
    statusEl.className = 'err'; statusEl.textContent = 'error: ' + e.message;
  }
}

render();
loadList();
</script>
</body>
</html>`;

// ── server ───────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const query = Object.fromEntries(url.searchParams);

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PAGE);
    } else if (req.method === 'GET' && url.pathname === '/api/list') {
      await handleList(req, res);
    } else if (req.method === 'GET' && url.pathname === '/api/get') {
      await handleGet(req, res, query);
    } else if (req.method === 'POST' && url.pathname === '/api/save') {
      await handleSave(req, res);
    } else if (req.method === 'POST' && url.pathname === '/api/delete') {
      await handleDelete(req, res);
    } else {
      res.writeHead(404);
      res.end('not found');
    }
  } catch (e) {
    sendJSON(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log('\n  ✓ admin running at http://localhost:' + PORT + '\n');
});
