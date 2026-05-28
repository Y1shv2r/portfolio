// ── STATE ────────────────────────────────────────────────
const output = document.getElementById('output');
const input  = document.getElementById('cmd-input');

let cwd = '~', cmdHistory = [], histIdx = -1;
let CONTENT = { projects: [], blogs: [] }; // loaded from content/index.json

// clock
const clockEl = document.getElementById('clock');
function tick(){ clockEl.textContent = new Date().toTimeString().slice(0,8); }
tick(); setInterval(tick, 1000);

// ── CONTENT LOADER ───────────────────────────────────────
async function loadContent() {
  try {
    const res = await fetch('/portfolio/content/index.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    CONTENT = await res.json();
  } catch (e) {
    // Fallback: run fine with empty content, show a hint
    CONTENT = { projects: [], blogs: [] };
    console.warn('Could not load content/index.json — run build-index.js first.', e);
  }

  // Build virtual filesystem from loaded content
  buildFS();
  printWelcome();
  setTimeout(() => {
    createCommandButtons();
    createSuggestionBar();
  }, 100);
}

// ── VIRTUAL FILESYSTEM ───────────────────────────────────
let FS = {};

function buildFS() {
  const projectSlugs = CONTENT.projects.map(p => p.slug);
  const blogSlugs    = CONTENT.blogs.map(b => b.slug);

  FS = {
    '~':          { type: 'dir', children: ['about.md', 'projects', 'blogs', 'contact.md'] },
    '~/about.md': { type: 'file' },
    '~/contact.md':{ type: 'file' },
    '~/projects': { type: 'dir', children: projectSlugs },
    '~/blogs':    { type: 'dir', children: blogSlugs },
  };

  projectSlugs.forEach(s => { FS[`~/projects/${s}`] = { type: 'dir', children: ['meta.json'] }; });
  blogSlugs.forEach(s =>    { FS[`~/blogs/${s}`]    = { type: 'dir', children: ['meta.json'] }; });
}

function findEntry(slug) {
  return [...CONTENT.projects, ...CONTENT.blogs].find(e => e.slug === slug) || null;
}

// ── HELPERS ──────────────────────────────────────────────
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function getPrompt(){ return `yash@portfolio:${cwd}$ `; }
function updatePrompt(){ document.getElementById('prompt-label').textContent = getPrompt(); }
function scrollBottom(){ output.scrollTop = output.scrollHeight; }

function addLine(cls, text) {
  const el = document.createElement('span');
  el.className = 'line ' + cls;
  if (cls === 'welcome-ascii') {
    el.style.cssText = 'white-space:pre;display:block;overflow-x:auto;';
  }
  el.textContent = text;
  output.appendChild(el);
}

function addEmpty(){ const el = document.createElement('span'); el.className = 'line empty'; output.appendChild(el); }
function addHR()   { const hr = document.createElement('hr');   hr.className = 'divider';    output.appendChild(hr); }

function addPromptEcho(cmd) {
  const row = document.createElement('div');
  row.className = 'prompt-line';
  row.innerHTML = `<span class="prompt-text">${esc(getPrompt())}</span><span class="cmd-echo">${esc(cmd)}</span>`;
  output.appendChild(row);
}

function resolvePath(p) {
  if (!p || p === '~') return '~';
  if (p === '..') {
    if (cwd === '~') return '~';
    const parts = cwd.split('/'); parts.pop(); return parts.join('/') || '~';
  }
  if (p.startsWith('~/')) return p;
  return cwd + '/' + p;
}

// ── STATIC FILE CONTENT ──────────────────────────────────
const FILES = {
  '~/about.md': [
    ['section-head', '# Yash Vardhan Kumar'], ['empty'],
    ['output-text bright', 'Embedded & Robotics Engineer.'],
    ['output-text', 'I build machines that think and move.'], ['empty'],
    ['output-text', 'Passionate about low-level systems, real-time control,'],
    ['output-text', 'and the intersection of hardware and intelligence.'], ['empty'],
  ],
  '~/contact.md': [
    ['section-head', '── Contact'], ['empty'],
    ['output-text', 'GitHub     →  github.com/yashvardhankumar'],
    ['output-text', 'LinkedIn   →  linkedin.com/in/yashvardhankumar'],
    ['output-text', 'Instagram  →  instagram.com/yashvardhankumar'],
    ['output-text', 'Email      →  yash@example.com'], ['empty'],
  ],
};

function printFile(path) {
  const lines = FILES[path]; if (!lines) return;
  lines.forEach(([cls, text]) => { if (cls === 'empty') addEmpty(); else addLine(cls, text); });
}

// ── BLOCK RENDERER (the GitHub README-style viewer) ──────
function renderBlocks(entry) {
  if (!entry.blocks || !entry.blocks.length) {
    addLine('output-text dim', '(no content blocks)');
    return;
  }

  entry.blocks.forEach(block => {
    switch (block.type) {

      case 'text': {
        const p = document.createElement('p');
        p.className = 'block-text';
        p.textContent = block.content || '';
        output.appendChild(p);
        addEmpty();
        break;
      }

      case 'image': {
        const wrap = document.createElement('div');
        wrap.className = 'block-image';
        // src is relative to the entry's folder
        const folder = `content/${entry.section}/${entry.slug}/`;
        const img = document.createElement('img');
        img.src = folder + block.src;
        img.alt = block.caption || block.src;
        img.loading = 'lazy';
        img.onerror = function() {
          // If image not found, show a placeholder box
          this.replaceWith(makePlaceholder('image', block.src));
        };
        wrap.appendChild(img);
        if (block.caption) {
          const cap = document.createElement('div');
          cap.className = 'block-caption';
          cap.textContent = block.caption;
          wrap.appendChild(cap);
        }
        output.appendChild(wrap);
        addEmpty();
        break;
      }

      case 'video': {
        const wrap = document.createElement('div');
        wrap.className = 'block-video';
        const folder = `content/${entry.section}/${entry.slug}/`;
        const video = document.createElement('video');
        video.src = folder + block.src;
        video.controls = true;
        video.preload = 'metadata';
        video.onerror = function() {
          this.replaceWith(makePlaceholder('video', block.src));
        };
        wrap.appendChild(video);
        if (block.caption) {
          const cap = document.createElement('div');
          cap.className = 'block-caption';
          cap.textContent = block.caption;
          wrap.appendChild(cap);
        }
        output.appendChild(wrap);
        addEmpty();
        break;
      }

      case 'doc': {
        // Rendered as a downloadable link card
        const folder = `content/${entry.section}/${entry.slug}/`;
        const card = document.createElement('a');
        card.href = folder + block.src;
        card.target = '_blank';
        card.className = 'block-doc';
        card.innerHTML = `
          <span class="block-doc-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </span>
          <span class="block-doc-name">${esc(block.src)}</span>
          <span class="block-doc-caption">${esc(block.caption || 'open document')}</span>
        `;
        output.appendChild(card);
        addEmpty();
        break;
      }

      default:
        addLine('output-text error', `Unknown block type: ${block.type}`);
    }
  });
}

function makePlaceholder(type, src) {
  const box = document.createElement('div');
  box.className = 'block-placeholder';
  box.innerHTML = `
    <span class="ph-icon">${type === 'video' ? '▶' : '▣'}</span>
    <span class="ph-label">${esc(src)}</span>
    <span class="ph-hint">(file not found in repo yet)</span>
  `;
  return box;
}

// ── NANO VIEWER ──────────────────────────────────────────
let nanoActive = false;

function openNano(entry) {
  nanoActive = true;

  const overlay = document.createElement('div');
  overlay.id = 'nano-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:var(--bg);z-index:1000;
    display:flex;flex-direction:column;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text);
  `;

  const topbar = document.createElement('div');
  topbar.style.cssText = 'background:#0e0e0e;border-bottom:1px solid #1e1e1e;padding:6px 16px;display:flex;justify-content:space-between;align-items:center;color:#444;font-size:11px;flex-wrap:wrap;gap:8px;flex-shrink:0;';
  topbar.innerHTML = `<span>GNU nano — <span style="color:#888">${esc(entry.title)}</span></span><span style="color:#2a2a2a">[ Read Only ]&nbsp;&nbsp;^X Exit</span>`;

  const body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:24px 32px;scrollbar-width:thin;scrollbar-color:#1e1e1e transparent;';

  // Header
  body.innerHTML += `<div style="color:#b0b0b0;font-size:16px;font-weight:500;letter-spacing:0.04em;margin-bottom:4px;">${esc(entry.title)}</div>`;
  body.innerHTML += `<div style="color:#333;font-size:11px;margin-bottom:4px;">${esc(entry.date)}&nbsp;&nbsp;·&nbsp;&nbsp;${(entry.tags||[]).map(t=>`<span style="border:1px solid #1e1e1e;padding:1px 6px;margin-right:4px;color:#3a3a3a">${esc(t)}</span>`).join('')}</div>`;
  body.innerHTML += `<div style="color:#555;font-size:11px;margin-bottom:14px;">${esc(entry.description)}</div>`;
  body.innerHTML += `<hr style="border:none;border-top:1px solid #161616;margin:0 0 20px 0;">`;

  // Blocks — append into body using a temp container trick
  const blockHost = document.createElement('div');
  body.appendChild(blockHost);

  // Temporarily redirect output to blockHost, render blocks, restore
  const realOutput = output;
  // We'll render blocks directly into blockHost
  renderBlocksInto(entry, blockHost);

  const botbar = document.createElement('div');
  botbar.style.cssText = 'background:#0e0e0e;border-top:1px solid #1e1e1e;padding:6px 16px;display:flex;gap:24px;font-size:11px;color:#333;flex-wrap:wrap;flex-shrink:0;';
  botbar.innerHTML = `
    <span><span style="background:#222;color:#666;padding:1px 6px;">^X</span>&nbsp;Exit</span>
    <span><span style="background:#222;color:#666;padding:1px 6px;">ESC</span>&nbsp;Close</span>
    <span><span style="background:#222;color:#666;padding:1px 6px;">↑↓</span>&nbsp;Scroll</span>
  `;

  overlay.appendChild(topbar);
  overlay.appendChild(body);
  overlay.appendChild(botbar);
  document.body.appendChild(overlay);
  body.focus();

  function closeNano(e) {
    if (e.key==='q'||e.key==='Q'||(e.ctrlKey&&(e.key==='x'||e.key==='X'))||e.key==='Escape') {
      document.removeEventListener('keydown', closeNano);
      overlay.remove();
      nanoActive = false;
      input.focus();
      addLine('output-text dim', '[ nano closed ]');
      addEmpty();
      scrollBottom();
    }
  }

  // Close button on topbar
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ close';
  closeBtn.style.cssText = 'background:transparent;border:none;color:#444;cursor:pointer;font-family:inherit;font-size:11px;padding:4px 8px;';
  closeBtn.addEventListener('click', () => closeNano({ key: 'Escape' }));
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#888');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#444');
  topbar.appendChild(closeBtn);

  document.addEventListener('keydown', closeNano);
}

// Renders blocks into a specific container (used by nano overlay)
function renderBlocksInto(entry, container) {
  if (!entry.blocks || !entry.blocks.length) {
    const p = document.createElement('p');
    p.style.color = '#444';
    p.textContent = '(no content blocks)';
    container.appendChild(p);
    return;
  }

  const folder = `content/${entry.section}/${entry.slug}/`;

  entry.blocks.forEach(block => {
    switch (block.type) {

      case 'text': {
        const p = document.createElement('p');
        p.className = 'block-text';
        p.textContent = block.content || '';
        container.appendChild(p);
        const sp = document.createElement('span');
        sp.className = 'line empty';
        container.appendChild(sp);
        break;
      }

      case 'image': {
        const wrap = document.createElement('div');
        wrap.className = 'block-image';
        const img = document.createElement('img');
        img.src = folder + block.src;
        img.alt = block.caption || block.src;
        img.loading = 'lazy';
        img.onerror = function() { this.replaceWith(makePlaceholder('image', block.src)); };
        wrap.appendChild(img);
        if (block.caption) {
          const cap = document.createElement('div');
          cap.className = 'block-caption';
          cap.textContent = block.caption;
          wrap.appendChild(cap);
        }
        container.appendChild(wrap);
        const sp = document.createElement('span');
        sp.className = 'line empty';
        container.appendChild(sp);
        break;
      }

      case 'video': {
        const wrap = document.createElement('div');
        wrap.className = 'block-video';
        const video = document.createElement('video');
        video.src = folder + block.src;
        video.controls = true;
        video.preload = 'metadata';
        video.onerror = function() { this.replaceWith(makePlaceholder('video', block.src)); };
        wrap.appendChild(video);
        if (block.caption) {
          const cap = document.createElement('div');
          cap.className = 'block-caption';
          cap.textContent = block.caption;
          wrap.appendChild(cap);
        }
        container.appendChild(wrap);
        const sp = document.createElement('span');
        sp.className = 'line empty';
        container.appendChild(sp);
        break;
      }

      case 'doc': {
        const card = document.createElement('a');
        card.href = folder + block.src;
        card.target = '_blank';
        card.className = 'block-doc';
        card.innerHTML = `
          <span class="block-doc-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </span>
          <span class="block-doc-name">${esc(block.src)}</span>
          <span class="block-doc-caption">${esc(block.caption || 'open document')}</span>
        `;
        container.appendChild(card);
        const sp = document.createElement('span');
        sp.className = 'line empty';
        container.appendChild(sp);
        break;
      }

      default: {
        const err = document.createElement('span');
        err.className = 'line output-text error';
        err.textContent = `Unknown block type: ${block.type}`;
        container.appendChild(err);
      }
    }
  });
}

// ── COMMAND BUTTONS ──────────────────────────────────────
function createCommandButtons() {
  if (document.getElementById('command-buttons')) return;
  const inputRow = document.getElementById('input-row');
  const container = document.createElement('div');
  container.id = 'command-buttons';

  const cmds = [
    { cmd: 'help',     label: ' help' },
    { cmd: 'whoami',   label: ' about' },
    { cmd: 'skills',   label: ' skills' },
    { cmd: 'projects', label: ' projects' },
    { cmd: 'blogs',    label: ' blogs' },
    { cmd: 'contact',  label: ' contact' },
    { cmd: 'clear',    label: ' clear' },
  ];

  cmds.forEach(c => {
    const btn = document.createElement('button');
    btn.textContent = c.label;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      input.value = c.cmd;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      input.focus();
    });
    container.appendChild(btn);
  });

  inputRow.parentNode.insertBefore(container, inputRow.nextSibling);
}

// ── SUGGESTION BAR ───────────────────────────────────────
let suggestionTimeout;
function createSuggestionBar() {
  if (document.getElementById('suggestion-bar')) return;
  const inputRow = document.getElementById('input-row');
  const bar = document.createElement('div');
  bar.id = 'suggestion-bar';
  inputRow.parentNode.insertBefore(bar, inputRow);

  const allCmds = ['help','whoami','skills','projects','blogs','contact','clear','ls','cd','cat','nano','pwd'];

  input.addEventListener('input', () => {
    clearTimeout(suggestionTimeout);
    suggestionTimeout = setTimeout(() => {
      const val = input.value.trim().toLowerCase();
      bar.innerHTML = '';
      if (!val) return;
      allCmds.filter(c => c.startsWith(val)).slice(0, 6).forEach(cmd => {
        const chip = document.createElement('span');
        chip.textContent = cmd;
        chip.addEventListener('click', () => {
          input.value = cmd;
          bar.innerHTML = '';
          input.focus();
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        });
        bar.appendChild(chip);
      });
    }, 300);
  });
}

// ── COMMANDS ─────────────────────────────────────────────
const COMMANDS = {
  help() {
    addEmpty(); addLine('section-head', 'Commands'); addHR();
    [
      ['ls [path]',      'list directory'],
      ['cd <dir>',       'change directory'],
      ['cat <file>',     'read a file'],
      ['nano <name>',    'open project or blog'],
      ['pwd',            'working directory'],
      ['whoami',         'about me'],
      ['skills',         'technical skills'],
      ['projects',       'all projects'],
      ['blogs',          'all blogs'],
      ['contact',        'contact info'],
      ['clear',          'clear screen'],
      ['history',        'command history'],
    ].forEach(([c, d]) => addLine('output-text', `  ${c.padEnd(22)} ${d}`));
    addEmpty();
  },

  pwd()    { addLine('output-text bright', '/home/' + cwd.replace('~','yash')); addEmpty(); },
  whoami() { printFile('~/about.md'); addEmpty(); },
  contact(){ printFile('~/contact.md'); addEmpty(); },
  clear()  { output.innerHTML = ''; printWelcome(); },

  history() {
    addEmpty();
    if (!cmdHistory.length) addLine('output-text dim', 'No history.');
    else cmdHistory.forEach((h, i) => addLine('output-text dim', `  ${String(i+1).padStart(3)}  ${h}`));
    addEmpty();
  },

  skills() {
    addEmpty(); addLine('section-head', '── Technical Skills'); addHR();
    [
      { cat: 'Embedded',  items: 'STM32 · ESP32 · AVR · RP2040 · FreeRTOS · Zephyr' },
      { cat: 'Protocols', items: 'UART · SPI · I2C · CAN · USB · Ethernet' },
      { cat: 'Robotics',  items: 'ROS2 · MoveIt · PID Control · Path Planning · SLAM' },
      { cat: 'Languages', items: 'C · C++ · Python · Bash · Assembly (ARM)' },
      { cat: 'Tools',     items: 'Git · KiCad · Fusion360 · Docker · Logic Analyzer · Oscilloscope' },
      { cat: 'PCB & CAD', items: 'Altium · Eagle · SolidWorks · Fusion 360' },
    ].forEach(s => {
      addLine('output-text bright', `[${s.cat}]`);
      addLine('output-text dim', `  ${s.items}`);
      addEmpty();
    });
    addEmpty();
  },

  ls(args) {
    const target = args[0] ? resolvePath(args[0]) : cwd;
    const node = FS[target];
    addEmpty();
    if (!node) { addLine('output-text error', `ls: cannot access '${args[0]}': No such file or directory`); addEmpty(); return; }

    const isListable = (target === '~/projects' || target === '~/blogs');
    if (isListable) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
      node.children.forEach(slug => {
        const s = document.createElement('span');
        s.className = 'dir-entry';
        s.style.cssText = 'min-width:200px;cursor:pointer;padding:4px 0;';
        s.textContent = slug;
        s.title = `nano ${slug}`;
        s.addEventListener('click', () => {
          input.value = `nano ${slug}`;
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        });
        row.appendChild(s);
      });
      output.appendChild(row);
      addEmpty();
      addLine('output-text dim', `  nano <name>  to open · ${node.children.length} item(s)`);
    } else {
      const dirs  = node.children.filter(c => !c.includes('.') || c.endsWith('/'));
      const files = node.children.filter(c => c.includes('.') && !c.endsWith('/'));
      if (dirs.length) {
        const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;';
        dirs.forEach(d => { const s = document.createElement('span'); s.className = 'dir-entry'; s.textContent = d+'/'; row.appendChild(s); });
        output.appendChild(row);
      }
      if (files.length) {
        const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;';
        files.forEach(f => { const s = document.createElement('span'); s.className = 'file-entry'; s.textContent = f; row.appendChild(s); });
        output.appendChild(row);
      }
    }
    addEmpty();
  },

  cd(args) {
    if (!args[0] || args[0] === '~') { cwd = '~'; updatePrompt(); addEmpty(); return; }
    const t = resolvePath(args[0]);
    const node = FS[t];
    if (!node)                 { addLine('output-text error', `cd: no such file or directory: ${args[0]}`); addEmpty(); return; }
    if (node.type !== 'dir')   { addLine('output-text error', `cd: not a directory: ${args[0]}`);           addEmpty(); return; }
    cwd = t; updatePrompt(); addEmpty();
  },

  cat(args) {
    if (!args[0]) { addLine('output-text error', 'cat: missing operand'); addEmpty(); return; }
    const t = resolvePath(args[0]);
    addEmpty();
    if (FILES[t]) { printFile(t); addEmpty(); return; }
    addLine('output-text error', `cat: ${args[0]}: No such file or directory`);
    addEmpty();
  },

  projects() {
    addEmpty(); addLine('section-head', '── Projects'); addHR();
    if (!CONTENT.projects.length) { addLine('output-text dim', '(no projects found — run build-index.js)'); addEmpty(); return; }
    CONTENT.projects.forEach(p => printCard(p));
    addEmpty();
    addLine('output-text dim', 'cd projects  →  ls  →  nano <name>  to open');
    addEmpty();
  },

  blogs() {
    addEmpty(); addLine('section-head', '── Blogs'); addHR();
    if (!CONTENT.blogs.length) { addLine('output-text dim', '(no blogs found — run build-index.js)'); addEmpty(); return; }
    CONTENT.blogs.forEach(b => printCard(b));
    addEmpty();
    addLine('output-text dim', 'cd blogs  →  ls  →  nano <name>  to open');
    addEmpty();
  },

  nano(args) {
    if (!args[0]) { addLine('output-text error', 'nano: specify a project or blog name'); addEmpty(); return; }
    const name = args.join('-').replace(/\.md$/, '');

    if (name === 'about' || name === 'about.md') { addEmpty(); printFile('~/about.md'); addEmpty(); scrollBottom(); return; }
    if (name === 'contact' || name === 'contact.md') { addEmpty(); printFile('~/contact.md'); addEmpty(); scrollBottom(); return; }

    const entry = findEntry(name);
    if (entry) { openNano(entry); }
    else { addLine('output-text error', `nano: '${name}': No such file, project or blog`); addEmpty(); }
  },

  open(args) {
    if (!args[0]) { addLine('output-text error', 'open: specify a name'); addEmpty(); return; }
    const entry = findEntry(args[0]);
    addEmpty();
    if (entry) {
      addLine('section-head', `── ${entry.title}`); addHR();
      printCard(entry);
      addEmpty();
      addLine('output-text dim', `nano ${entry.slug}  to read in full`);
    } else {
      addLine('output-text error', `open: '${args[0]}' not found`);
    }
    addEmpty();
  },
};

// ── CARD RENDERER ─────────────────────────────────────────
function printCard(entry) {
  const c = document.createElement('div');
  c.className = 'card';
  c.style.cursor = 'pointer';
  c.innerHTML = `
    <div class="card-title">${esc(entry.title)}</div>
    <div class="card-meta">${esc(entry.date)}&nbsp;&nbsp;·&nbsp;&nbsp;${(entry.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>
    <div class="card-desc">${esc(entry.description)}</div>
  `;
  c.addEventListener('click', () => openNano(entry));
  output.appendChild(c);
}

// ── WELCOME ───────────────────────────────────────────────
function printWelcome() {
  const a = [
    '   ██████╗   ██████╗   ██████╗   ███████╗         ██╗   ██╗   █████╗   ███████╗   ██╗  ██╗',
    '  ██╔════╝  ██╔══██╗  ██╔══██╗  ██╔════╝         ╚██╗ ██╔╝  ██╔══██╗  ██╔════╝   ██║  ██║',
    '  ██║       ██║   ██║  ██████╔╝  █████╗            ╚████╔╝   ███████║  ███████╗   ███████║',
    '  ██║       ██║   ██║  ██╔══██╗  ██╔══╝             ╚██╔╝    ██╔══██║  ╚════██║   ██╔══██║',
    '  ╚██████╗  ╚██████╔╝  ██║  ██║  ███████╗            ██║     ██║  ██║  ███████║   ██║  ██║',
    '   ╚═════╝   ╚═════╝   ╚═╝  ╚═╝  ╚══════╝            ╚═╝     ╚═╝  ╚═╝  ╚══════╝   ╚═╝  ╚═╝',
  ];
  a.forEach(l => addLine('output-text dim', l));
  addEmpty();
  addLine('output-text dim', '  Type  help  for available commands.');
  addEmpty();
}

// ── INPUT HANDLER ─────────────────────────────────────────
input.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const raw = input.value.trim(); input.value = '';
    addPromptEcho(raw);
    if (raw) { cmdHistory.unshift(raw); if (cmdHistory.length > 100) cmdHistory.pop(); histIdx = -1; }
    if (!raw) { addEmpty(); scrollBottom(); return; }
    const parts = raw.split(/\s+/), cmd = parts[0].toLowerCase(), args = parts.slice(1);
    if (COMMANDS[cmd]) COMMANDS[cmd](args);
    else { addLine('output-text error', `command not found: ${cmd}`); addLine('output-text dim', 'Type  help  for available commands.'); addEmpty(); }
    scrollBottom();
    const bar = document.getElementById('suggestion-bar');
    if (bar) bar.innerHTML = '';
  }
  if (e.key === 'ArrowUp')   { e.preventDefault(); if (histIdx < cmdHistory.length-1) { histIdx++; input.value = cmdHistory[histIdx]; } }
  if (e.key === 'ArrowDown') { e.preventDefault(); if (histIdx > 0) { histIdx--; input.value = cmdHistory[histIdx]; } else { histIdx = -1; input.value = ''; } }
  if (e.key === 'Tab') {
    e.preventDefault();
    const parts = input.value.split(/\s+/);
    if (parts.length >= 2) {
      const partial = parts[parts.length-1], node = FS[cwd];
      if (node && node.children) {
        const m = node.children.filter(c => c.startsWith(partial));
        if (m.length === 1) { parts[parts.length-1] = m[0]; input.value = parts.join(' '); }
      }
    }
  }
});

// ── RESIZE ────────────────────────────────────────────────
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(scrollBottom, 250);
});

// ── RESUME ────────────────────────────────────────────────
function openResume()  { document.getElementById('resume-overlay').classList.add('active'); document.addEventListener('keydown', resumeKeyHandler); }
function closeResume() { document.getElementById('resume-overlay').classList.remove('active'); document.removeEventListener('keydown', resumeKeyHandler); input.focus(); }
function resumeKeyHandler(e) { if (e.key === 'Escape') closeResume(); }
function downloadResume() {
  const a = document.createElement('a');
  a.href = document.getElementById('resume-img').src;
  a.download = 'yash-vardhan-kumar-resume.png';
  a.click();
}

// Click anywhere → focus input
document.addEventListener('click', e => {
  if (!e.target.closest('#resume-overlay') &&
      !e.target.closest('.resume-btn') &&
      !e.target.closest('.social-btn') &&
      !e.target.closest('#command-buttons') &&
      !e.target.closest('#suggestion-bar') &&
      !e.target.closest('#nano-overlay')) {
    input.focus();
  }
});

// ── BOOT ──────────────────────────────────────────────────
loadContent();
