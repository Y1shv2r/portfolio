import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const PORT = 4317;

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function safeSlug(value) {
  return String(value || '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
function safeName(value) {
  return path.basename(String(value || ''));
}
function sectionPath(section, slug) {
  if (!['projects', 'blogs'].includes(section)) throw new Error('Invalid section');
  const clean = safeSlug(slug);
  if (!clean) throw new Error('Invalid slug');
  return path.join(CONTENT, section, clean);
}
async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}
async function rebuildIndex() {
  const result = { generated: new Date().toISOString(), projects: [], blogs: [] };
  for (const section of ['projects', 'blogs']) {
    const dir = path.join(CONTENT, section);
    await fs.mkdir(dir, { recursive: true });
    const names = await fs.readdir(dir, { withFileTypes: true });
    for (const item of names.filter(x => x.isDirectory())) {
      const meta = await readJson(path.join(dir, item.name, 'meta.json'));
      if (!meta) continue;
      result[section].push({
        slug: item.name,
        section,
        title: meta.title || item.name,
        startDate: meta.startDate ?? meta.date ?? '',
        endDate: meta.endDate ?? '',
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        description: meta.description || '',
        blocks: Array.isArray(meta.blocks) ? meta.blocks : []
      });
    }
    result[section].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }
  await fs.writeFile(path.join(CONTENT, 'index.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}
async function getContent() {
  return (await readJson(path.join(CONTENT, 'index.json'))) || await rebuildIndex();
}

app.get('/api/content', async (_req, res) => {
  try { res.json(await getContent()); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/git-status', async (_req, res) => {
  try {
    const { stdout } = await exec('git', ['status', '--short'], { cwd: ROOT });
    res.json({ dirty: Boolean(stdout.trim()), status: stdout.trim() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }
});

app.post('/api/content/:section/:slug/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('No file selected');
    const dir = sectionPath(req.params.section, req.params.slug);
    await fs.mkdir(dir, { recursive: true });
    const filename = safeName(req.file.originalname);
    if (!filename) throw new Error('Invalid filename');
    await fs.writeFile(path.join(dir, filename), req.file.buffer);
    res.json({ filename });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/content/:section', async (req, res) => {
  try {
    const { section } = req.params;
    if (!['projects', 'blogs'].includes(section)) throw new Error('Invalid section');
    const body = req.body || {};
    const slug = safeSlug(body.slug || body.title);
    if (!slug) throw new Error('Title or slug is required');
    const dir = sectionPath(section, slug);
    await fs.mkdir(dir, { recursive: true });
    const existing = await readJson(path.join(dir, 'meta.json'), {});
    const meta = {
      title: String(body.title || '').trim(),
      date: String(body.date || '').trim(),
      startDate: String(body.startDate || body.date || '').trim(),
      endDate: String(body.endDate || '').trim(),
      tags: Array.isArray(body.tags) ? body.tags.map(String).map(x => x.trim()).filter(Boolean) : [],
      description: String(body.description || '').trim(),
      blocks: Array.isArray(body.blocks) ? body.blocks.map(b => ({
        type: ['text','image','video','doc'].includes(b.type) ? b.type : 'text',
        ...(b.src ? { src: safeName(b.src) } : {}),
        ...(b.caption ? { caption: String(b.caption) } : {}),
        ...(b.content !== undefined ? { content: String(b.content) } : {})
      })) : (existing.blocks || [])
    };
    if (!meta.title) throw new Error('Title is required');
    await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
    const index = await rebuildIndex();
    res.json({ ok: true, slug, content: index });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/content/:section/:slug', async (req, res) => {
  try {
    const dir = sectionPath(req.params.section, req.params.slug);
    await fs.rm(dir, { recursive: true, force: true });
    const index = await rebuildIndex();
    res.json({ ok: true, content: index });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/rebuild', async (_req, res) => {
  try { res.json({ ok: true, content: await rebuildIndex() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/git/commit', async (req, res) => {
  try {
    const message = String(req.body?.message || 'Update portfolio content').trim();
    if (!message) throw new Error('Commit message is required');
    await exec('git', ['add', 'content'], { cwd: ROOT });
    await exec('git', ['commit', '-m', message], { cwd: ROOT });
    res.json({ ok: true, message });
  } catch (e) {
    const detail = e.stderr || e.stdout || e.message;
    res.status(400).json({ error: String(detail).trim() });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Portfolio Content Manager: http://127.0.0.1:${PORT}`);
  console.log(`Repository: ${ROOT}`);
});
