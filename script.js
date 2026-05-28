// ── STATE ────────────────────────────────────────────────
const output = document.getElementById('output');
const input  = document.getElementById('cmd-input');

let cwd = '~', cmdHistory = [], histIdx = -1;
let CONTENT = { projects: [], blogs: [] };

// clock
const clockEl = document.getElementById('clock');
function tick(){ clockEl.textContent = new Date().toTimeString().slice(0,8); }
tick(); setInterval(tick, 1000);

// ── CONTENT LOADER ───────────────────────────────────────
async function loadContent() {
  try {
    // Determine the base path for GitHub Pages compatibility
    let baseUrl = '/';
    
    // Check if we're on GitHub Pages
    if (window.location.hostname.includes('github.io')) {
      // Get the path and determine base
      const pathParts = window.location.pathname.split('/').filter(p => p);
      console.log('GitHub Pages detected. Path parts:', pathParts);
      
      // If pathname is /portfolio/... use /portfolio/ as base
      if (pathParts[0] === 'portfolio') {
        baseUrl = '/portfolio/';
      }
      // If pathname is /<username>.github.io/... then base is /
      else if (window.location.hostname.includes('.github.io')) {
        baseUrl = '/';
      }
    }
    
    // Try multiple possible paths
    let response = null;
    const paths = [
      baseUrl + 'content/index.json',
      'content/index.json', 
      '/content/index.json', 
      './content/index.json'
    ];
    
    console.log('Loading content. Base URL:', baseUrl, 'Location:', window.location.href);
    
    for (const path of paths) {
      try {
        console.log('Trying path:', path);
        response = await fetch(path);
        if (response.ok) {
          console.log('✓ Found content at:', path);
          break;
        }
        console.log('✗ Failed:', path, response.status);
      } catch (e) { 
        console.log('✗ Error:', path, e.message);
        continue; 
      }
    }
    
    if (response && response.ok) {
      CONTENT = await response.json();
      console.log('Content loaded:', CONTENT.projects.length, 'projects,', CONTENT.blogs.length, 'blogs');
    } else {
      throw new Error('No content found');
    }
  } catch (e) {
    CONTENT = { projects: [], blogs: [] };
    console.warn('Could not load content/index.json', e);
  }

  buildFS();
  printWelcome();
  
  // Create buttons after content loads - ALWAYS create them
  setTimeout(() => {
    try {
      createCommandButtons();
      createSuggestionBar();
    } catch (err) {
      console.error('Error creating buttons:', err);
    }
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
    '~/projects': { type: 'dir', children: projectSlugs.length ? projectSlugs : ['(no projects yet)'] },
    '~/blogs':    { type: 'dir', children: blogSlugs.length ? blogSlugs : ['(no blogs yet)'] },
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
const STATIC_FILES = {
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
  const lines = STATIC_FILES[path]; 
  if (!lines) return;
  lines.forEach(([cls, text]) => { if (cls === 'empty') addEmpty(); else addLine(cls, text); });
}

// ── BLOCK RENDERER ──────────────────────────────────────
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
        const folder = `content/${entry.section}/${entry.slug}/`;
        const img = document.createElement('img');
        img.src = folder + block.src;
        img.alt = block.caption || block.src;
        img.loading = 'lazy';
        img.onerror = function() { this.outerHTML = `<div class="block-placeholder"><span class="ph-icon">▣</span><span class="ph-label">${esc(block.src)}</span><span class="ph-hint">(file not found)</span></div>`; };
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
        video.onerror = function() { this.outerHTML = `<div class="block-placeholder"><span class="ph-icon">▶</span><span class="ph-label">${esc(block.src)}</span><span class="ph-hint">(file not found)</span></div>`; };
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
        const folder = `content/${entry.section}/${entry.slug}/`;
        const card = document.createElement('a');
        card.href = folder + block.src;
        card.target = '_blank';
        card.className = 'block-doc';
        card.innerHTML = `
          <span class="block-doc-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
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
  topbar.innerHTML = `<span>GNU nano — <span style="color:#888">${esc(entry.title)}</span></span>`;

  const closeTopBtn = document.createElement('button');
  closeTopBtn.textContent = '✕ close';
  closeTopBtn.style.cssText = 'background:transparent;border:none;color:#444;cursor:pointer;font-family:inherit;font-size:11px;';
  closeTopBtn.onclick = () => closeNanoHandler();
  topbar.appendChild(closeTopBtn);

  const body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:24px 32px;scrollbar-width:thin;';

  body.innerHTML += `<div style="color:#b0b0b0;font-size:16px;font-weight:500;margin-bottom:4px;">${esc(entry.title)}</div>`;
  body.innerHTML += `<div style="color:#333;font-size:11px;margin-bottom:4px;">${esc(entry.date)}&nbsp;&nbsp;·&nbsp;&nbsp;${(entry.tags||[]).map(t=>`<span style="border:1px solid #1e1e1e;padding:1px 6px;margin-right:4px;color:#3a3a3a">${esc(t)}</span>`).join('')}</div>`;
  body.innerHTML += `<div style="color:#555;font-size:11px;margin-bottom:14px;">${esc(entry.description)}</div>`;
  body.innerHTML += `<hr style="border:none;border-top:1px solid #161616;margin:0 0 20px 0;">`;

  const blockHost = document.createElement('div');
  body.appendChild(blockHost);
  
  // Render blocks into the overlay
  if (entry.blocks && entry.blocks.length) {
    const folder = `content/${entry.section}/${entry.slug}/`;
    entry.blocks.forEach(block => {
      switch (block.type) {
        case 'text': {
          const p = document.createElement('p');
          p.className = 'block-text';
          p.textContent = block.content || '';
          blockHost.appendChild(p);
          blockHost.appendChild(document.createElement('br'));
          break;
        }
        case 'image': {
          const wrap = document.createElement('div');
          wrap.className = 'block-image';
          const img = document.createElement('img');
          img.src = folder + block.src;
          img.alt = block.caption || block.src;
          img.style.maxWidth = '100%';
          wrap.appendChild(img);
          if (block.caption) {
            const cap = document.createElement('div');
            cap.className = 'block-caption';
            cap.textContent = block.caption;
            wrap.appendChild(cap);
          }
          blockHost.appendChild(wrap);
          blockHost.appendChild(document.createElement('br'));
          break;
        }
        case 'video': {
          const wrap = document.createElement('div');
          wrap.className = 'block-video';
          const video = document.createElement('video');
          video.src = folder + block.src;
          video.controls = true;
          video.style.width = '100%';
          wrap.appendChild(video);
          if (block.caption) {
            const cap = document.createElement('div');
            cap.className = 'block-caption';
            cap.textContent = block.caption;
            wrap.appendChild(cap);
          }
          blockHost.appendChild(wrap);
          blockHost.appendChild(document.createElement('br'));
          break;
        }
        case 'doc': {
          const card = document.createElement('a');
          card.href = folder + block.src;
          card.target = '_blank';
          card.className = 'block-doc';
          card.innerHTML = `
            <span class="block-doc-icon">📄</span>
            <span class="block-doc-name">${esc(block.src)}</span>
            <span class="block-doc-caption">${esc(block.caption || 'open')}</span>
          `;
          blockHost.appendChild(card);
          blockHost.appendChild(document.createElement('br'));
          break;
        }
      }
    });
  } else {
    blockHost.innerHTML = '<p style="color:#444">(no content blocks)</p>';
  }

  const botbar = document.createElement('div');
  botbar.style.cssText = 'background:#0e0e0e;border-top:1px solid #1e1e1e;padding:6px 16px;display:flex;gap:24px;font-size:11px;color:#333;flex-wrap:wrap;flex-shrink:0;';
  botbar.innerHTML = `<span><span style="background:#222;color:#666;padding:1px 6px;">ESC</span>&nbsp;Close</span>`;

  overlay.appendChild(topbar);
  overlay.appendChild(body);
  overlay.appendChild(botbar);
  document.body.appendChild(overlay);

  function closeNanoHandler() {
    overlay.remove();
    nanoActive = false;
    input.focus();
    addLine('output-text dim', '[ nano closed ]');
    addEmpty();
    scrollBottom();
  }

  document.addEventListener('keydown', function closeNano(e) {
    if (e.key === 'Escape') {
      closeNanoHandler();
      document.removeEventListener('keydown', closeNano);
    }
  });
}

// ── COMMAND BUTTONS (TOUCH/CLICK FRIENDLY) ───────────────
function createCommandButtons() {
  const container = document.getElementById('command-buttons');
  if (!container) {
    console.warn('command-buttons container not found');
    return;
  }
  
  container.innerHTML = '';

  const cmds = [
    { cmd: 'help',     label: '❓ help' },
    { cmd: 'whoami',   label: '👤 about' },
    { cmd: 'skills',   label: '🛠️ skills' },
    { cmd: 'projects', label: '📁 projects' },
    { cmd: 'blogs',    label: '📝 blogs' },
    { cmd: 'contact',  label: '📞 contact' },
    { cmd: 'clear',    label: '🗑️ clear' },
  ];

  cmds.forEach(c => {
    const btn = document.createElement('button');
    btn.textContent = c.label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      input.value = c.cmd;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      input.focus();
    });
    container.appendChild(btn);
  });
}

// ── SUGGESTION BAR ───────────────────────────────────────
let suggestionTimeout;
function createSuggestionBar() {
  const bar = document.getElementById('suggestion-bar');
  if (!bar) return;
  
  const allCmds = ['help', 'whoami', 'skills', 'projects', 'blogs', 'contact', 'clear', 'ls', 'cd', 'cat', 'nano', 'pwd'];

  input.addEventListener('input', () => {
    clearTimeout(suggestionTimeout);
    suggestionTimeout = setTimeout(() => {
      const val = input.value.trim().toLowerCase();
      bar.innerHTML = '';
      if (!val) return;
      
      const matches = allCmds.filter(c => c.startsWith(val));
      matches.slice(0, 6).forEach(cmd => {
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
      { cat: 'Tools',     items: 'Git · KiCad · Fusion360 · Docker · Logic Analyzer' },
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
    if (!node) { addLine('output-text error', `ls: cannot access '${args[0]}'`); addEmpty(); return; }
    
    if (node.children) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
      node.children.forEach(item => {
        const s = document.createElement('span');
        s.className = node.type === 'dir' ? 'dir-entry' : 'file-entry';
        s.style.cssText = 'min-width:180px;cursor:pointer;padding:4px 0;';
        s.textContent = item;
        s.addEventListener('click', () => {
          if (node.type === 'dir' && item !== '(no projects yet)' && item !== '(no blogs yet)') {
            input.value = `cd ${item}`;
          } else if (STATIC_FILES[`~/${item}`]) {
            input.value = `cat ${item}`;
          } else {
            input.value = `nano ${item}`;
          }
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        });
        row.appendChild(s);
      });
      output.appendChild(row);
    }
    addEmpty();
  },
  
  cd(args) {
    if (!args[0] || args[0] === '~') { cwd = '~'; updatePrompt(); addEmpty(); return; }
    const t = resolvePath(args[0]);
    const node = FS[t];
    if (!node) { addLine('output-text error', `cd: no such directory: ${args[0]}`); addEmpty(); return; }
    if (node.type !== 'dir') { addLine('output-text error', `cd: not a directory: ${args[0]}`); addEmpty(); return; }
    cwd = t; updatePrompt(); addEmpty();
  },
  
  cat(args) {
    if (!args[0]) { addLine('output-text error', 'cat: missing operand'); addEmpty(); return; }
    const t = resolvePath(args[0]);
    addEmpty();
    if (STATIC_FILES[t]) { printFile(t); addEmpty(); return; }
    addLine('output-text error', `cat: ${args[0]}: No such file`);
    addEmpty();
  },
  
  projects() {
    addEmpty(); addLine('section-head', '── Projects'); addHR();
    if (!CONTENT.projects.length) { addLine('output-text dim', '(no projects found)'); addEmpty(); return; }
    CONTENT.projects.forEach(p => printCard(p));
    addEmpty();
    addLine('output-text dim', 'cd projects  →  ls  →  nano <name>');
    addEmpty();
  },
  
  blogs() {
    addEmpty(); addLine('section-head', '── Blogs'); addHR();
    if (!CONTENT.blogs.length) { addLine('output-text dim', '(no blogs found)'); addEmpty(); return; }
    CONTENT.blogs.forEach(b => printCard(b));
    addEmpty();
    addLine('output-text dim', 'cd blogs  →  ls  →  nano <name>');
    addEmpty();
  },
  
  nano(args) {
    if (!args[0]) { addLine('output-text error', 'nano: specify a name'); addEmpty(); return; }
    const name = args.join('-').replace(/\.md$/, '');
    
    if (name === 'about' || name === 'about.md') { addEmpty(); printFile('~/about.md'); addEmpty(); scrollBottom(); return; }
    if (name === 'contact' || name === 'contact.md') { addEmpty(); printFile('~/contact.md'); addEmpty(); scrollBottom(); return; }
    
    const entry = findEntry(name);
    if (entry) { openNano(entry); }
    else { addLine('output-text error', `nano: '${name}': Not found`); addEmpty(); }
  },
  
  open(args) {
    if (!args[0]) { addLine('output-text error', 'open: specify a name'); addEmpty(); return; }
    const entry = findEntry(args[0]);
    addEmpty();
    if (entry) {
      addLine('section-head', `── ${entry.title}`); addHR();
      printCard(entry);
      addEmpty();
      addLine('output-text dim', `nano ${entry.slug}  to read full`);
    } else {
      addLine('output-text error', `open: '${args[0]}' not found`);
    }
    addEmpty();
  },
};

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
  a.forEach(l => addLine('welcome-ascii', l));
  addEmpty();
  addLine('output-text dim', '  Type  help  for available commands.  Click buttons below ↓');
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
    else { addLine('output-text error', `command not found: ${cmd}`); addLine('output-text dim', 'Type help for commands.'); addEmpty(); }
    scrollBottom();
    const bar = document.getElementById('suggestion-bar');
    if (bar) bar.innerHTML = '';
  }
  if (e.key === 'ArrowUp') { e.preventDefault(); if (histIdx < cmdHistory.length-1) { histIdx++; input.value = cmdHistory[histIdx]; } }
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
function openResume() { 
  const overlay = document.getElementById('resume-overlay');
  if (overlay) overlay.classList.add('active'); 
  document.addEventListener('keydown', resumeKeyHandler); 
}
function closeResume() { 
  const overlay = document.getElementById('resume-overlay');
  if (overlay) overlay.classList.remove('active'); 
  document.removeEventListener('keydown', resumeKeyHandler); 
  input.focus(); 
}
function resumeKeyHandler(e) { if (e.key === 'Escape') closeResume(); }
function downloadResume() {
  const a = document.createElement('a');
  const img = document.getElementById('resume-img');
  if (img && img.src) {
    a.href = img.src;
    a.download = 'yash-vardhan-kumar-resume.png';
    a.click();
  }
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
// Ensure buttons are created immediately, even if async loading has issues
window.addEventListener('DOMContentLoaded', () => {
  try {
    createCommandButtons();
    createSuggestionBar();
  } catch (err) {
    console.error('Error creating buttons on DOMContentLoaded:', err);
  }
});

loadContent();