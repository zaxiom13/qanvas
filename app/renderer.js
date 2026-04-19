/* ================================================================
   QANVAS5 — RENDERER PROCESS
   Manages: Monaco editor, project state, sidebar, examples library,
            console, toolbar controls, modals, and local persistence.
================================================================ */

'use strict';

const STORAGE_KEYS = {
  runtimePath: 'runtimePath',
  projectName: 'qanvas5:projectName',
  sidebarCollapsed: 'qanvas5:sidebarCollapsed',
};

const DEFAULT_PROJECT_NAME = 'untitled';
const SIDEBAR_ANIMATION_MS = 220;

const DEFAULT_SKETCH = `setup:{
  \`size\`bg!(800 600;0xF4ECD8)
}

draw:{[state;frameInfo;input;canvas]
  background[0xF4ECD8];
  circle[([]
    p:enlist 0.5*canvas\`size;
    r:enlist 44+18*sin 0.05*frameInfo\`frameNum;
    fill:enlist 0x5B6FE8;
    alpha:enlist 0.92
  )];
  state
}
`;

const SKETCH_ADJECTIVES = [
  'cosmic',
  'warm',
  'gentle',
  'ember',
  'lunar',
  'quiet',
  'velvet',
  'mellow',
  'glowing',
  'soft',
  'golden',
  'tender',
];

const SKETCH_NOUNS = [
  'spiral',
  'glow',
  'bloom',
  'ripple',
  'drift',
  'garden',
  'echo',
  'field',
  'ring',
  'trail',
  'galaxy',
  'current',
];

const $ = (selector) => document.querySelector(selector);

const state = {
  projectPath: null,
  projectName: loadSavedProjectName(),
  files: ['sketch.q'],
  activeFile: 'sketch.q',
  fileContents: { 'sketch.q': DEFAULT_SKETCH },
  assets: [],
  unsaved: false,
  isSettingEditorValue: false,

  runtimePath: localStorage.getItem(STORAGE_KEYS.runtimePath) || '',
  runtimeOk: false,
  running: false,
  paused: false,

  consoleFilter: 'all',
  consoleBuf: [],
  CONSOLE_CAP: 2000,

  showFps: false,
  fps: 0,

  sidebarCollapsed: localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === '1',
  exampleCategory: 'All',
  demoPreset: 'default',
};

const dom = {
  workspace: $('#workspace'),
  sidebar: $('#sidebar'),
  btnSidebarToggle: $('#btn-sidebar-toggle'),
  btnSidebarExpand: $('#btn-sidebar-expand'),

  btnRun: $('#btn-run'),
  btnPause: $('#btn-pause'),
  btnReset: $('#btn-reset'),
  btnFpsToggle: $('#btn-fps-toggle'),
  btnExportPng: $('#btn-export-png'),
  btnExportGif: $('#btn-export-gif'),
  btnSettings: $('#btn-settings'),
  btnNewFile: $('#btn-new-file'),
  btnImportAsset: $('#btn-import-asset'),
  btnClearConsole: $('#btn-clear-console'),
  btnNewSketch: $('#btn-new-sketch'),
  btnExamples: $('#btn-examples'),
  fpsDisplay: $('#fps-display'),

  projectName: $('#project-name'),
  projectNameInput: $('#project-name-input'),
  btnProjectRename: $('#btn-project-rename'),
  unsavedDot: $('#unsaved-dot'),
  activeTabName: $('#active-tab-name'),
  fileTree: $('#file-tree'),
  assetTree: $('#asset-tree'),

  runtimeStatus: $('#runtime-status'),
  runtimeLabel: $('#runtime-status-label'),
  sketchOverlay: $('#sketch-overlay'),
  canvasSizeLabel: $('#canvas-size-label'),
  consoleOutput: $('#console-output'),
  filterBtns: document.querySelectorAll('.console-filter-btn'),

  modalSettings: $('#modal-settings'),
  runtimePathInput: $('#runtime-path-input'),
  btnDetectRuntime: $('#btn-detect-runtime'),
  runtimeDetectStatus: $('#runtime-detect-status'),
  btnSettingsClose: $('#btn-settings-close'),
  btnSettingsCancel: $('#btn-settings-cancel'),
  btnSettingsSave: $('#btn-settings-save'),

  modalNewFile: $('#modal-new-file'),
  newFileInput: $('#new-file-input'),
  btnNewFileClose: $('#btn-new-file-close'),
  btnNewFileCancel: $('#btn-new-file-cancel'),
  btnNewFileConfirm: $('#btn-new-file-confirm'),

  modalExportGif: $('#modal-export-gif'),
  gifDurationInput: $('#gif-duration-input'),
  btnExportGifClose: $('#btn-export-gif-close'),
  btnExportGifCancel: $('#btn-export-gif-cancel'),
  btnExportGifStart: $('#btn-export-gif-start'),

  modalUnsaved: $('#modal-unsaved'),
  btnUnsavedDiscard: $('#btn-unsaved-discard'),
  btnUnsavedCancel: $('#btn-unsaved-cancel'),
  btnUnsavedSave: $('#btn-unsaved-save'),

  modalExamples: $('#modal-examples'),
  btnExamplesClose: $('#btn-examples-close'),
  examplesFilters: $('#examples-filters'),
  examplesGrid: $('#examples-grid'),
};

let monacoEditor = null;
let sidebarLayoutTimer = null;
let contextMenuEl = null;
let unsavedResolve = null;

function loadSavedProjectName() {
  return localStorage.getItem(STORAGE_KEYS.projectName) || DEFAULT_PROJECT_NAME;
}

function initMonaco() {
  require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });

  require(['vs/editor/editor.main'], () => {
    monaco.languages.register({ id: 'q' });
    monaco.languages.setMonarchTokensProvider('q', qLanguageTokens());

    monaco.editor.defineTheme('qanvas-warm', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: 'A89B8E', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7D4E2D' },
        { token: 'number', foreground: '5B6FE8' },
        { token: 'string', foreground: 'B35B3F' },
        { token: 'type', foreground: '8B674B' },
      ],
      colors: {
        'editor.background': '#FFFDF9',
        'editor.foreground': '#2C2520',
        'editorLineNumber.foreground': '#B5A799',
        'editorLineNumber.activeForeground': '#7A6E62',
        'editorCursor.foreground': '#5B6FE8',
        'editor.selectionBackground': '#DDE2FF',
        'editor.inactiveSelectionBackground': '#EEE8DD',
        'editor.lineHighlightBackground': '#F7F1E9',
        'editorIndentGuide.background1': '#EAE0D2',
        'editorWhitespace.foreground': '#D6CABB',
        'editorWidget.background': '#FFFDF9',
        'editorWidget.border': '#E0D8CC',
        'scrollbarSlider.background': '#C9BDABAA',
        'scrollbarSlider.hoverBackground': '#B8AA96CC',
      },
    });

    monacoEditor = monaco.editor.create($('#monaco-editor'), {
      value: state.fileContents[state.activeFile],
      language: 'q',
      theme: 'qanvas-warm',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 13,
      lineHeight: 20,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      padding: { top: 16, bottom: 16 },
      renderLineHighlight: 'line',
      cursorBlinking: 'smooth',
      smoothScrolling: true,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      renderWhitespace: 'selection',
      folding: true,
      lineNumbers: 'on',
      glyphMargin: false,
      overviewRulerBorder: false,
      scrollbar: {
        verticalScrollbarSize: 6,
        horizontalScrollbarSize: 6,
      },
    });

    monacoEditor.onDidChangeModelContent(() => {
      if (state.isSettingEditorValue) return;
      state.fileContents[state.activeFile] = monacoEditor.getValue();
      markUnsaved(true);
    });

    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveCurrentFile());
    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => toggleSidebar());
    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE, () => toggleExamples());
    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, () => { void createNewSketch(); });
    monacoEditor.addCommand(monaco.KeyCode.Escape, () => { $('#canvas-container')?.focus(); });

    applySidebarState(state.sidebarCollapsed, { instant: true });
  });
}

function qLanguageTokens() {
  return {
    tokenizer: {
      root: [
        [/\/.*$/, 'comment'],
        [/^\\[a-z]+/, 'keyword'],
        [/\{/, 'delimiter.curly'],
        [/\}/, 'delimiter.curly'],
        [/-?[0-9]+[.e]?[0-9]*[ijfhb]?/, 'number'],
        [/`[a-zA-Z0-9._]*/, 'type'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/"\\?."/, 'string'],
        [/\b(select|from|where|by|update|delete|exec|insert|upsert|each|over|scan|prior|flip|enlist|count|first|last|avg|sum|min|max|all|any|not|neg|abs|sqrt|exp|log|sin|cos|tan|string|value|key|type|null|inf|asc|desc|iasc|idesc|distinct|group|ungroup|cols|meta|tables|views|load|save|get|set|til|do|while|if|and|or|like|ss|sv|vs|in|within|bin|binr|asof|aj|aj0|lj|lj0|ij|ij0|pj|uj|wj|wj1|fby|xasc|xdesc|xgroup|xcols|xcept|inter|union|diff|except)\b/, 'keyword'],
        [/[a-zA-Z_][a-zA-Z0-9_.]*/, 'identifier'],
        [/[+\-*%!@#$&|^~<>=?_,;:.]/, 'operator'],
        [/\s+/, 'white'],
      ],
    },
  };
}

function updateToolbarState() {
  const canRun = state.runtimeOk;
  dom.btnRun.disabled = !canRun;
  dom.btnPause.disabled = !state.running;
  dom.btnReset.disabled = !state.running;

  if (state.running && !state.paused) {
    dom.btnRun.classList.add('running');
    dom.btnRun.querySelector('.btn-run-label').textContent = 'Stop';
    dom.btnRun.querySelector('.btn-run-icon polygon').setAttribute('points', '4,2 12,2 12,14 4,14');
  } else {
    dom.btnRun.classList.remove('running');
    dom.btnRun.querySelector('.btn-run-label').textContent = 'Run';
    dom.btnRun.querySelector('.btn-run-icon polygon').setAttribute('points', '4,2 14,8 4,14');
  }

  if (state.paused) {
    dom.btnPause.classList.add('paused');
    dom.btnPause.querySelector('.btn-pause-label').textContent = 'Resume';
  } else {
    dom.btnPause.classList.remove('paused');
    dom.btnPause.querySelector('.btn-pause-label').textContent = 'Pause';
  }
}

function setOverlay(mode, payload = {}) {
  const overlay = dom.sketchOverlay;
  const content = overlay.querySelector('.overlay-content');

  overlay.className = 'sketch-overlay';

  switch (mode) {
    case 'idle':
      overlay.classList.add('sketch-overlay--idle');
      content.innerHTML = `
        <svg class="overlay-icon" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="var(--accent)" stroke-width="2"/>
          <polygon points="19,16 35,24 19,32" fill="var(--accent)"/>
        </svg>
        <p class="overlay-label">Press <kbd>Run</kbd> to start</p>
        <div class="overlay-actions">
          <button class="overlay-link" type="button" onclick="openExamples()">or browse examples</button>
        </div>
      `;
      break;

    case 'running':
      overlay.classList.add('sketch-overlay--running');
      content.innerHTML = '';
      break;

    case 'stopped':
      overlay.classList.add('sketch-overlay--stopped');
      content.innerHTML = `
        <svg class="overlay-icon" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="var(--text-secondary)" stroke-width="2"/>
          <rect x="16" y="16" width="16" height="16" rx="2" fill="var(--text-secondary)"/>
        </svg>
        <p class="overlay-label">Sketch stopped</p>
      `;
      break;

    case 'error':
      overlay.classList.add('sketch-overlay--error');
      content.innerHTML = `
        <svg class="overlay-icon" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="var(--red)" stroke-width="2"/>
          <path d="M24 14v12M24 32v2" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <p class="overlay-label">Sketch error</p>
        ${payload.message ? `<div class="overlay-error-msg">${escHtml(payload.message)}</div>` : ''}
      `;
      break;

    case 'runtime-missing':
      overlay.classList.add('sketch-overlay--idle');
      content.innerHTML = `
        <svg class="overlay-icon" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="var(--red)" stroke-width="2"/>
          <path d="M24 14v12M24 32v2" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <p class="overlay-label">q runtime not configured</p>
        <div class="overlay-actions">
          <button class="btn-primary overlay-primary-action" type="button" onclick="openSettings()">Configure</button>
          <button class="overlay-link" type="button" onclick="openExamples()">Browse examples</button>
        </div>
      `;
      break;

    default:
      overlay.classList.add('sketch-overlay--idle');
      break;
  }
}

function runSketch() {
  if (!state.runtimeOk) return;
  state.running = true;
  state.paused = false;
  syncCanvasDemoPreset();
  setOverlay('running');
  updateToolbarState();
  appendConsole('info', `▶ Running ${state.activeFile}`);
  window.qCanvas?.run();
}

function stopSketch(options = {}) {
  const { quiet = false } = options;
  state.running = false;
  state.paused = false;
  updateToolbarState();
  window.qCanvas?.stop();

  if (!quiet) {
    setOverlay('stopped');
    appendConsole('info', '■ Stopped');
  }
}

function pauseSketch() {
  if (!state.running) return;
  state.paused = true;
  updateToolbarState();
  appendConsole('info', '⏸ Paused');
  window.qCanvas?.pause();
}

function resumeSketch() {
  if (!state.running) return;
  state.paused = false;
  updateToolbarState();
  appendConsole('info', '▶ Resumed');
  window.qCanvas?.resume();
}

function resetSketch() {
  setOverlay('running');
  appendConsole('info', '↺ Reset');
  window.qCanvas?.reset();
  const container = $('#canvas-container');
  container.classList.add('canvas-flash');
  setTimeout(() => container.classList.remove('canvas-flash'), 200);
}

function markUnsaved(next) {
  state.unsaved = Boolean(next);
  dom.unsavedDot.hidden = !state.unsaved;
}

function saveCurrentEditorValue() {
  if (!monacoEditor) return;
  state.fileContents[state.activeFile] = monacoEditor.getValue();
}

function setEditorValue(value) {
  if (!monacoEditor) return;
  state.isSettingEditorValue = true;
  monacoEditor.setValue(value);
  state.isSettingEditorValue = false;
}

function setProjectName(name, options = {}) {
  const { persist = true } = options;
  const nextName = (name || '').trim() || DEFAULT_PROJECT_NAME;
  state.projectName = nextName;
  dom.projectName.textContent = nextName;
  dom.projectNameInput.value = nextName;
  document.title = `${nextName} · Qanvas5`;

  if (persist) {
    localStorage.setItem(STORAGE_KEYS.projectName, nextName);
  }
}

function startProjectRename() {
  if (!dom.projectNameInput.hidden) return;
  dom.projectName.hidden = true;
  dom.btnProjectRename.hidden = true;
  dom.projectNameInput.hidden = false;
  dom.projectNameInput.value = state.projectName;
  dom.projectNameInput.focus();
  dom.projectNameInput.select();
}

function finishProjectRename(commit) {
  if (dom.projectNameInput.hidden) return;

  if (commit) {
    setProjectName(dom.projectNameInput.value);
  } else {
    dom.projectNameInput.value = state.projectName;
  }

  dom.projectNameInput.hidden = true;
  dom.projectName.hidden = false;
  dom.btnProjectRename.hidden = false;
}

function renderFileTree() {
  dom.fileTree.innerHTML = '';

  state.files.forEach((filename) => {
    const item = document.createElement('div');
    item.className = 'file-item' + (filename === state.activeFile ? ' file-item--active' : '');
    item.dataset.file = filename;

    const isSketch = filename === 'sketch.q';
    item.innerHTML = `
      <svg class="file-icon" viewBox="0 0 16 16" fill="none">
        <path d="M4 2h6l3 3v9H4V2z" stroke="currentColor" stroke-width="1" fill="none"/>
        <path d="M10 2v3h3" stroke="currentColor" stroke-width="1" fill="none"/>
      </svg>
      <span class="file-name">${escHtml(filename)}</span>
      ${!isSketch ? `
        <div class="file-item-actions">
          <button class="file-action-btn" data-action="rename" title="Rename">
            <svg viewBox="0 0 16 16" fill="none"><path d="M3 13h10M8 3l-4 4v2h2l4-4-2-2zM10 5l2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
          </button>
          <button class="file-action-btn" data-action="delete" title="Delete">
            <svg viewBox="0 0 16 16" fill="none"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/><path d="M4 4l1 9h6l1-9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>
          </button>
        </div>
      ` : ''}
    `;

    item.addEventListener('click', (event) => {
      if (event.target.closest('.file-action-btn')) return;
      switchFile(filename);
    });

    item.querySelectorAll('.file-action-btn').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (button.dataset.action === 'rename') startInlineRename(item, filename);
        if (button.dataset.action === 'delete') deleteFile(filename);
      });
    });

    item.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      showContextMenu(event.clientX, event.clientY, filename, isSketch);
    });

    dom.fileTree.appendChild(item);
  });

  dom.activeTabName.textContent = state.activeFile;
}

function switchFile(filename) {
  if (filename === state.activeFile) return;
  saveCurrentEditorValue();
  state.activeFile = filename;
  if (!Object.prototype.hasOwnProperty.call(state.fileContents, filename)) {
    state.fileContents[filename] = '';
  }
  renderFileTree();
  setEditorValue(state.fileContents[filename]);
}

function startInlineRename(item, oldName) {
  const nameSpan = item.querySelector('.file-name');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'file-name-input';
  input.value = oldName;
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  const finish = (commit) => {
    if (commit) {
      const newName = input.value.trim();
      if (newName && newName !== oldName && !state.files.includes(newName)) {
        const index = state.files.indexOf(oldName);
        state.files[index] = newName;
        state.fileContents[newName] = state.fileContents[oldName];
        delete state.fileContents[oldName];
        if (state.activeFile === oldName) state.activeFile = newName;
        markUnsaved(true);
      }
    }
    renderFileTree();
  };

  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') finish(true);
    if (event.key === 'Escape') finish(false);
  });
}

function deleteFile(filename) {
  if (!confirm(`Delete "${filename}"?`)) return;

  const index = state.files.indexOf(filename);
  if (index === -1) return;

  state.files.splice(index, 1);
  delete state.fileContents[filename];

  if (state.activeFile === filename) {
    state.activeFile = state.files[0] || 'sketch.q';
    setEditorValue(state.fileContents[state.activeFile] || '');
  }

  markUnsaved(true);
  renderFileTree();
}

function openNewFileModal() {
  dom.newFileInput.value = '';
  dom.newFileInput.style.borderColor = '';
  dom.modalNewFile.hidden = false;
  setTimeout(() => dom.newFileInput.focus(), 40);
}

function closeNewFileModal() {
  dom.modalNewFile.hidden = true;
}

function confirmNewFile() {
  const rawName = dom.newFileInput.value.trim();
  if (!rawName) return;

  const name = rawName.includes('.') ? rawName : `${rawName}.q`;
  if (state.files.includes(name)) {
    dom.newFileInput.style.borderColor = 'var(--red)';
    return;
  }

  saveCurrentEditorValue();
  state.files.push(name);
  state.fileContents[name] = `/ ${name}\n`;
  markUnsaved(true);
  closeNewFileModal();
  switchFile(name);
}

function renderAssetTree() {
  dom.assetTree.innerHTML = '';

  if (!state.assets.length) {
    const dropZone = document.createElement('div');
    dropZone.className = 'asset-drop-zone';
    dropZone.id = 'asset-drop-zone';
    dropZone.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none"><path d="M12 16V8M9 11l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Drop files here</span>
    `;
    dom.assetTree.appendChild(dropZone);
    bindAssetDropZone(dropZone);
    return;
  }

  state.assets.forEach((name) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <svg class="file-icon" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1" fill="none"/>
        <path d="M2 9l3-3 3 3 2-2 4 4" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <circle cx="5.5" cy="6" r="0.8" fill="currentColor"/>
      </svg>
      <span class="file-name">${escHtml(name)}</span>
    `;
    dom.assetTree.appendChild(item);
  });
}

function bindAssetDropZone(zone) {
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('drag-over');
    handleAssetFiles(Array.from(event.dataTransfer.files));
  });
}

function handleAssetFiles(files) {
  files.forEach((file) => {
    state.assets.push(file.name);
    appendConsole('info', `Asset imported: ${file.name}`);
  });
  renderAssetTree();
  markUnsaved(true);
}

function saveCurrentFile() {
  saveCurrentEditorValue();
  markUnsaved(false);
  appendConsole('info', `Saved ${state.activeFile}`);

  if (window.electronAPI && state.projectPath) {
    const filePath = `${state.projectPath}/${state.activeFile}`;
    window.electronAPI.writeFile(filePath, state.fileContents[state.activeFile]).catch(console.error);
  }
}

function appendConsole(type, text) {
  state.consoleBuf.push({ type, text, ts: Date.now() });
  if (state.consoleBuf.length > state.CONSOLE_CAP) {
    state.consoleBuf.shift();
  }
  renderConsoleEntry({ type, text });
}

function renderConsoleEntry({ type, text }) {
  if (state.consoleFilter !== 'all' && type !== state.consoleFilter) return;

  const prefix = type === 'stdout' ? '›' : type === 'stderr' ? '✕' : '—';
  const line = document.createElement('div');
  line.className = `console-line console-line--${type}`;
  line.dataset.type = type;
  line.innerHTML = `
    <span class="console-prefix">${prefix}</span>
    <span class="console-text">${escHtml(text)}</span>
  `;

  dom.consoleOutput.appendChild(line);

  while (dom.consoleOutput.children.length > state.CONSOLE_CAP) {
    dom.consoleOutput.removeChild(dom.consoleOutput.firstChild);
  }

  dom.consoleOutput.scrollTop = dom.consoleOutput.scrollHeight;
}

function reRenderConsole() {
  dom.consoleOutput.innerHTML = '';
  state.consoleBuf.forEach(renderConsoleEntry);
}

function clearConsole(withWelcome = false) {
  state.consoleBuf = [];
  dom.consoleOutput.innerHTML = '';

  if (withWelcome) {
    appendConsole('info', 'Qanvas5 ready. Open a project or press Run to start.');
  }
}

function queueMonacoLayout(delay = SIDEBAR_ANIMATION_MS) {
  clearTimeout(sidebarLayoutTimer);
  sidebarLayoutTimer = setTimeout(() => monacoEditor?.layout(), delay);
}

function applySidebarState(collapsed, options = {}) {
  const { instant = false, persist = true } = options;

  state.sidebarCollapsed = Boolean(collapsed);
  dom.sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
  dom.workspace.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);

  if (persist) {
    localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, state.sidebarCollapsed ? '1' : '0');
  }

  if (instant) {
    monacoEditor?.layout();
  } else {
    queueMonacoLayout();
  }
}

function toggleSidebar() {
  applySidebarState(!state.sidebarCollapsed);
}

function generateSketchName() {
  let candidate = DEFAULT_PROJECT_NAME;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const adjective = SKETCH_ADJECTIVES[Math.floor(Math.random() * SKETCH_ADJECTIVES.length)];
    const noun = SKETCH_NOUNS[Math.floor(Math.random() * SKETCH_NOUNS.length)];
    candidate = `${adjective}-${noun}`;
    if (candidate !== state.projectName) break;
  }

  return candidate;
}

async function createNewSketch(template = DEFAULT_SKETCH, name = generateSketchName(), options = {}) {
  const decision = options.skipUnsaved ? 'continue' : await confirmUnsaved();
  if (decision === 'cancel') return false;

  if (state.running) {
    stopSketch({ quiet: true });
  } else {
    window.qCanvas?.stop();
  }

  state.projectPath = null;
  state.files = ['sketch.q'];
  state.activeFile = 'sketch.q';
  state.fileContents = { 'sketch.q': template };
  state.assets = [];
  state.demoPreset = options.preset || 'default';
  state.paused = false;
  state.running = false;

  renderFileTree();
  renderAssetTree();
  setEditorValue(template);
  setProjectName(name);
  markUnsaved(false);
  clearConsole(false);
  appendConsole('info', `New sketch: ${state.projectName}`);
  syncCanvasDemoPreset();

  if (state.runtimeOk) {
    setOverlay('idle');
  } else {
    setOverlay('runtime-missing');
  }

  return true;
}

function getExamples() {
  return Array.isArray(window.EXAMPLES) ? window.EXAMPLES : [];
}

function getExampleCategories() {
  return ['All', ...new Set(getExamples().map((example) => example.category))];
}

function renderExamplesFilters() {
  dom.examplesFilters.innerHTML = '';

  getExampleCategories().forEach((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `examples-filter-pill${state.exampleCategory === category ? ' examples-filter-pill--active' : ''}`;
    button.textContent = category;
    button.addEventListener('click', () => {
      state.exampleCategory = category;
      renderExamplesFilters();
      renderExamplesGrid();
    });
    dom.examplesFilters.appendChild(button);
  });
}

function renderExamplesGrid() {
  const selected = state.exampleCategory;
  const examples = getExamples().filter((example) => selected === 'All' || example.category === selected);

  dom.examplesGrid.innerHTML = '';

  examples.forEach((example) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'example-card';
    card.style.setProperty('--example-accent', example.accent || '#5B6FE8');
    card.innerHTML = `
      <div class="example-card-thumb">
        <div class="example-card-thumb-grid"></div>
        <span class="example-card-category">${escHtml(example.category)}</span>
      </div>
      <div class="example-card-body">
        <div class="example-card-header">
          <h3 class="example-card-title">${escHtml(example.name)}</h3>
          <div class="example-difficulty" aria-label="Difficulty ${example.difficulty} of 3">
            ${[1, 2, 3].map((index) => `<span class="example-difficulty-dot${index <= example.difficulty ? ' is-active' : ''}"></span>`).join('')}
          </div>
        </div>
        <p class="example-card-description">${escHtml(example.description)}</p>
      </div>
    `;

    card.addEventListener('click', async () => {
      closeExamples();
      const loaded = await createNewSketch(example.code, example.name, { preset: example.id });
      if (loaded) {
        appendConsole('info', `Loaded example: ${example.name}`);
      }
    });

    dom.examplesGrid.appendChild(card);
  });
}

function openExamples() {
  state.exampleCategory = state.exampleCategory || 'All';
  renderExamplesFilters();
  renderExamplesGrid();
  dom.modalExamples.hidden = false;
}

function closeExamples() {
  dom.modalExamples.hidden = true;
}

function toggleExamples() {
  if (dom.modalExamples.hidden) {
    openExamples();
  } else {
    closeExamples();
  }
}

function openSettings() {
  dom.runtimePathInput.value = state.runtimePath;
  dom.runtimeDetectStatus.hidden = true;
  dom.modalSettings.hidden = false;
}

function closeSettings() {
  dom.modalSettings.hidden = true;
}

function saveSettings() {
  state.runtimePath = dom.runtimePathInput.value.trim();
  localStorage.setItem(STORAGE_KEYS.runtimePath, state.runtimePath);
  validateRuntime();
  closeSettings();
}

function detectRuntimePath() {
  return null;
}

function validateRuntime() {
  const hasPath = state.runtimePath.length > 0;
  state.runtimeOk = hasPath;

  dom.runtimeStatus.className = `runtime-status ${hasPath ? 'runtime-status--ok' : 'runtime-status--missing'}`;
  dom.runtimeLabel.textContent = hasPath
    ? `q: ${state.runtimePath.split('/').pop() || state.runtimePath}`
    : 'q runtime not found';

  updateToolbarState();

  if (!state.running) {
    if (hasPath) {
      setOverlay('idle');
    } else {
      setOverlay('runtime-missing');
    }
  }
}

function confirmUnsaved() {
  return new Promise((resolve) => {
    if (!state.unsaved) {
      resolve('continue');
      return;
    }
    dom.modalUnsaved.hidden = false;
    unsavedResolve = resolve;
  });
}

function closeContextMenu() {
  if (contextMenuEl) {
    contextMenuEl.remove();
    contextMenuEl = null;
  }
}

function showContextMenu(x, y, filename, isSketch) {
  closeContextMenu();

  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.innerHTML = `
    <div class="context-menu-item" data-action="open">
      <svg viewBox="0 0 16 16" fill="none"><path d="M4 2h6l3 3v9H4V2z" stroke="currentColor" stroke-width="1" fill="none"/><path d="M10 2v3h3" stroke="currentColor" stroke-width="1" fill="none"/></svg>
      Open
    </div>
    ${!isSketch ? `
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" data-action="rename">
        <svg viewBox="0 0 16 16" fill="none"><path d="M3 13h10M8 3l-4 4v2h2l4-4-2-2z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>
        Rename
      </div>
      <div class="context-menu-item context-menu-item--danger" data-action="delete">
        <svg viewBox="0 0 16 16" fill="none"><path d="M3 4h10M5 4V3h6v1M4 4l1 9h6l1-9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>
        Delete
      </div>
    ` : ''}
  `;

  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  document.body.appendChild(menu);
  contextMenuEl = menu;

  menu.addEventListener('click', (event) => {
    const item = event.target.closest('.context-menu-item');
    if (!item) return;

    if (item.dataset.action === 'open') switchFile(filename);
    if (item.dataset.action === 'rename') {
      const fileItem = Array.from(dom.fileTree.children).find((child) => child.dataset.file === filename);
      if (fileItem) startInlineRename(fileItem, filename);
    }
    if (item.dataset.action === 'delete') deleteFile(filename);
    closeContextMenu();
  });

  document.addEventListener('click', closeContextMenu, { once: true });
  document.addEventListener('contextmenu', closeContextMenu, { once: true });
}

function syncCanvasDemoPreset() {
  window.qCanvas?.setDemoPreset?.(state.demoPreset);
}

async function openProject(dirPath) {
  state.projectPath = dirPath;
  const folderName = dirPath.split('/').pop() || DEFAULT_PROJECT_NAME;

  try {
    const entries = await window.electronAPI.readDir(dirPath);
    const qFiles = entries.filter((entry) => entry.endsWith('.q'));
    const orderedFiles = qFiles.includes('sketch.q')
      ? ['sketch.q', ...qFiles.filter((entry) => entry !== 'sketch.q')]
      : qFiles;

    if (!orderedFiles.length) {
      orderedFiles.push('sketch.q');
    }

    const contents = await Promise.all(
      orderedFiles.map(async (file) => {
        try {
          return [file, await window.electronAPI.readFile(`${dirPath}/${file}`)];
        } catch {
          return [file, file === 'sketch.q' ? DEFAULT_SKETCH : ''];
        }
      })
    );

    state.files = orderedFiles;
    state.activeFile = orderedFiles[0];
    state.fileContents = Object.fromEntries(contents);
    state.assets = [];
    state.demoPreset = 'default';

    renderFileTree();
    renderAssetTree();
    setEditorValue(state.fileContents[state.activeFile] || '');
    setProjectName(folderName);
    markUnsaved(false);
    syncCanvasDemoPreset();
    appendConsole('info', `Opened project: ${folderName}`);
  } catch (error) {
    appendConsole('stderr', `Failed to open project: ${error.message}`);
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isAccelShortcut(event) {
  return (event.metaKey || event.ctrlKey) && !event.altKey;
}

function closeVisibleModalOnEscape() {
  if (!dom.projectNameInput.hidden) {
    finishProjectRename(false);
    return true;
  }
  if (!dom.modalExamples.hidden) {
    closeExamples();
    return true;
  }
  if (!dom.modalSettings.hidden) {
    closeSettings();
    return true;
  }
  if (!dom.modalNewFile.hidden) {
    closeNewFileModal();
    return true;
  }
  if (!dom.modalExportGif.hidden) {
    dom.modalExportGif.hidden = true;
    return true;
  }
  if (!dom.modalUnsaved.hidden) {
    dom.modalUnsaved.hidden = true;
    unsavedResolve?.('cancel');
    unsavedResolve = null;
    return true;
  }
  return false;
}

dom.btnRun.addEventListener('click', () => {
  if (state.running) {
    stopSketch();
  } else {
    runSketch();
  }
});

dom.btnPause.addEventListener('click', () => {
  if (state.paused) {
    resumeSketch();
  } else {
    pauseSketch();
  }
});

dom.btnReset.addEventListener('click', () => resetSketch());

dom.btnFpsToggle.addEventListener('click', () => {
  state.showFps = !state.showFps;
  dom.fpsDisplay.hidden = !state.showFps;
  dom.btnFpsToggle.classList.toggle('is-active', state.showFps);
  window.qCanvas?.setShowFps(state.showFps);
});

dom.btnSidebarToggle.addEventListener('click', toggleSidebar);
dom.btnSidebarExpand.addEventListener('click', toggleSidebar);

dom.projectName.addEventListener('click', startProjectRename);
dom.btnProjectRename.addEventListener('click', startProjectRename);
dom.projectNameInput.addEventListener('blur', () => finishProjectRename(true));
dom.projectNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') finishProjectRename(true);
  if (event.key === 'Escape') finishProjectRename(false);
});

dom.btnNewFile.addEventListener('click', openNewFileModal);
dom.btnNewFileClose.addEventListener('click', closeNewFileModal);
dom.btnNewFileCancel.addEventListener('click', closeNewFileModal);
dom.btnNewFileConfirm.addEventListener('click', confirmNewFile);
dom.newFileInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') confirmNewFile();
  if (event.key === 'Escape') closeNewFileModal();
  dom.newFileInput.style.borderColor = '';
});

dom.btnImportAsset.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/*,.ttf,.otf,.woff,.woff2';
  input.addEventListener('change', () => handleAssetFiles(Array.from(input.files || [])));
  input.click();
});

dom.filterBtns.forEach((button) => {
  button.addEventListener('click', () => {
    dom.filterBtns.forEach((item) => item.classList.remove('console-filter-btn--active'));
    button.classList.add('console-filter-btn--active');
    state.consoleFilter = button.dataset.filter;
    reRenderConsole();
  });
});

dom.btnClearConsole.addEventListener('click', () => clearConsole(false));

dom.btnSettings.addEventListener('click', openSettings);
dom.btnSettingsClose.addEventListener('click', closeSettings);
dom.btnSettingsCancel.addEventListener('click', closeSettings);
dom.btnSettingsSave.addEventListener('click', saveSettings);
dom.modalSettings.querySelector('.modal-backdrop').addEventListener('click', closeSettings);

dom.btnDetectRuntime.addEventListener('click', () => {
  dom.runtimeDetectStatus.hidden = false;
  dom.runtimeDetectStatus.className = 'runtime-detect-status';
  dom.runtimeDetectStatus.textContent = 'Detecting…';

  setTimeout(() => {
    const detected = detectRuntimePath();
    if (detected) {
      dom.runtimePathInput.value = detected;
      dom.runtimeDetectStatus.classList.add('ok');
      dom.runtimeDetectStatus.textContent = `Found: ${detected}`;
    } else {
      dom.runtimeDetectStatus.classList.add('error');
      dom.runtimeDetectStatus.textContent = 'q not found on PATH or common locations.';
    }
  }, 600);
});

dom.btnNewSketch.addEventListener('click', () => { void createNewSketch(); });
dom.btnExamples.addEventListener('click', openExamples);
dom.btnExamplesClose.addEventListener('click', closeExamples);
dom.modalExamples.querySelector('.modal-backdrop').addEventListener('click', closeExamples);
dom.modalNewFile.querySelector('.modal-backdrop').addEventListener('click', closeNewFileModal);
dom.modalExportGif.querySelector('.modal-backdrop').addEventListener('click', () => { dom.modalExportGif.hidden = true; });
dom.modalUnsaved.querySelector('.modal-backdrop').addEventListener('click', () => {
  dom.modalUnsaved.hidden = true;
  unsavedResolve?.('cancel');
  unsavedResolve = null;
});

dom.btnExportPng.addEventListener('click', () => {
  const canvas = document.querySelector('#canvas-container canvas');
  if (!canvas) {
    appendConsole('stderr', 'No canvas to export. Run the sketch first.');
    return;
  }

  const link = document.createElement('a');
  link.download = `${state.activeFile.replace('.q', '')}-frame.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  appendConsole('info', 'PNG exported.');
});

dom.btnExportGif.addEventListener('click', () => {
  if (!state.running) {
    appendConsole('stderr', 'Sketch must be running to export GIF.');
    return;
  }
  dom.gifDurationInput.value = '3';
  dom.modalExportGif.hidden = false;
});

dom.btnExportGifClose.addEventListener('click', () => { dom.modalExportGif.hidden = true; });
dom.btnExportGifCancel.addEventListener('click', () => { dom.modalExportGif.hidden = true; });
dom.btnExportGifStart.addEventListener('click', () => {
  const duration = parseInt(dom.gifDurationInput.value, 10) || 3;
  dom.modalExportGif.hidden = true;
  appendConsole('info', `GIF recording started (${duration}s)…`);
  window.qCanvas?.startGifRecording(duration);
});

dom.btnUnsavedDiscard.addEventListener('click', () => {
  dom.modalUnsaved.hidden = true;
  unsavedResolve?.('discard');
  unsavedResolve = null;
});

dom.btnUnsavedCancel.addEventListener('click', () => {
  dom.modalUnsaved.hidden = true;
  unsavedResolve?.('cancel');
  unsavedResolve = null;
});

dom.btnUnsavedSave.addEventListener('click', () => {
  saveCurrentFile();
  dom.modalUnsaved.hidden = true;
  unsavedResolve?.('continue');
  unsavedResolve = null;
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && closeVisibleModalOnEscape()) {
    event.preventDefault();
    return;
  }

  if (!isAccelShortcut(event)) return;

  const key = event.key.toLowerCase();
  if (event.target.closest('.monaco-editor') && ['b', 'n', 'e'].includes(key)) return;

  if (key === 'b') {
    event.preventDefault();
    toggleSidebar();
    return;
  }
  if (key === 'n') {
    event.preventDefault();
    void createNewSketch();
    return;
  }
  if (key === 'e') {
    event.preventDefault();
    toggleExamples();
  }
});

if (window.electronAPI) {
  window.electronAPI.onMenuEvent('menu:save', () => saveCurrentFile());
  window.electronAPI.onMenuEvent('menu:open-project', async () => {
    const decision = await confirmUnsaved();
    if (decision === 'cancel') return;

    const dir = await window.electronAPI.openProjectDialog();
    if (!dir) return;

    await openProject(dir);
  });

  window.electronAPI.onRuntimeData((data) => {
    appendConsole('stdout', data);
    window.qCanvas?.receiveFrame(data);
  });

  window.electronAPI.onRuntimeError((data) => {
    appendConsole('stderr', data);
    setOverlay('error', { message: data });
    state.running = false;
    state.paused = false;
    updateToolbarState();
  });

  window.electronAPI.onRuntimeExit((code) => {
    if (state.running) {
      appendConsole('info', `q process exited (code ${code})`);
      stopSketch({ quiet: true });
      if (state.runtimeOk) setOverlay('idle');
    }
  });
}

window.__qanvasOnFps = (fps) => {
  state.fps = fps;
  if (state.showFps) {
    dom.fpsDisplay.textContent = `${fps} fps`;
  }
};

window.__appendConsole = appendConsole;
window.openSettings = openSettings;
window.openExamples = openExamples;
window.closeExamples = closeExamples;

function init() {
  setProjectName(state.projectName, { persist: false });
  renderFileTree();
  renderAssetTree();
  clearConsole(true);
  applySidebarState(state.sidebarCollapsed, { instant: true });
  validateRuntime();
  initMonaco();

  const canvasContainer = $('#canvas-container');
  canvasContainer.setAttribute('tabindex', '0');
  canvasContainer.addEventListener('mouseenter', () => {
    if (state.running) canvasContainer.focus({ preventScroll: true });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
