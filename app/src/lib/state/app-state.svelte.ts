import {
  EXAMPLES,
  GUIDED_TOUR_IDS,
  getExampleById,
  getNextTourExample,
  getPreviousTourExample,
  isTourExample,
} from '$lib/examples';
import { browserGateway } from '$lib/browser';
import { getCompiledOutputView } from '$lib/compiler/compiled-output';
import { StructuredConsoleFormatter } from '$lib/formatting/value-format';
import {
  PRACTICE_CHALLENGES,
  getPracticeChallenge,
  getPracticeChallengeNeighbours,
  getPracticeSolutionSource,
} from '$lib/practice-challenges';
import { DEFAULT_PROJECT_NAME, ProjectSessionController } from '$lib/state/project-session';
import { RuntimeCoordinator, type RuntimeProjectSource } from '$lib/state/runtime-coordinator';
import {
  createRuntimeControlState,
  isRuntimeActive,
  isRuntimePaused,
  isRuntimeTransitioning,
  type RuntimeFrameKind,
} from '$lib/state/runtime-control-fsm';

const STORAGE_KEYS = {
  runtimePath: 'runtimePath',
  projectName: 'qanvas5:projectName',
  sidebarCollapsed: 'qanvas5:sidebarCollapsed',
  workspaceMode: 'qanvas5:workspaceMode',
  practiceChallengeId: 'qanvas5:practiceChallengeId',
  practiceCompleted: 'qanvas5:practiceCompleted',
  practiceStepsExpanded: 'qanvas5:practiceStepsExpanded',
  debugConsole: 'qanvas5:debugConsole',
  consoleHeight: 'qanvas5:consoleHeight',
  editorPanelWidth: 'qanvas5:editorPanelWidth',
  lastExampleId: 'qanvas5:lastExampleId',
  tourCompleted: 'qanvas5:tourCompleted',
};

const PRACTICE_FILE_NAME = 'practice.q';

export const DEFAULT_SKETCH = `setup:{
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

const SKETCH_ADJECTIVES = ['cosmic', 'warm', 'gentle', 'ember', 'lunar', 'quiet', 'velvet', 'mellow', 'glowing', 'soft', 'golden', 'tender'];
const SKETCH_NOUNS = ['spiral', 'glow', 'bloom', 'ripple', 'drift', 'garden', 'echo', 'field', 'trail', 'galaxy', 'current'];

type OverlayMode = 'idle' | 'running' | 'stopped' | 'error' | 'runtime-missing';
type ModalName = null | 'settings' | 'new-file' | 'examples' | 'projects' | 'export-gif' | 'unsaved';
type UnsavedDecision = 'continue' | 'discard' | 'cancel';
type WorkspaceMode = 'studio' | 'practice';
type CanvasPanelTab = 'canvas' | 'compiled';
type PracticeVerification = {
  status: 'idle' | 'match' | 'mismatch' | 'error';
  actual: unknown;
  expected: unknown;
  message: string;
};

function readStored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function readStoredNumber(key: string, fallback: number) {
  const value = readStored(key);
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readStoredSet(key: string) {
  const value = readStored(key);
  if (!value) return new Set<string>();
  try {
    const parsed = JSON.parse(value);
    return new Set<string>(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function writeStoredSet(key: string, value: Set<string>) {
  writeStored(key, JSON.stringify([...value]));
}

class AppState {
  projectPath = $state<string | null>(null);
  projectName = $state(readStored(STORAGE_KEYS.projectName) || DEFAULT_PROJECT_NAME);
  projectNameDraft = $state(this.projectName);
  files = $state<SketchFile[]>([{ name: 'sketch.q', content: DEFAULT_SKETCH }]);
  activeFileName = $state('sketch.q');
  practiceSource = $state(getPracticeChallenge(readStored(STORAGE_KEYS.practiceChallengeId) || PRACTICE_CHALLENGES[0].id).starterCode);
  assets = $state<AssetEntry[]>([]);
  unsaved = $state(true);
  projectsRoot = $state('');
  projectLibrary = $state<ProjectLibraryEntry[]>([]);
  projectLibraryLoading = $state(false);

  runtimePath = $state(readStored(STORAGE_KEYS.runtimePath) || '');
  runtimePathDraft = $state(this.runtimePath);
  runtimeOk = $state(Boolean(this.runtimePath));
  runtimeDetectStatus = $state('');
  runtimeDetectTone = $state<'idle' | 'ok' | 'error'>('idle');

  runtimeControl = $state(createRuntimeControlState());
  overlayMode = $state<OverlayMode>(this.runtimeOk ? 'idle' : 'runtime-missing');
  overlayMessage = $state('');
  showFps = $state(false);
  debugConsole = $state(readStored(STORAGE_KEYS.debugConsole) === '1');
  fps = $state(0);
  currentCanvasSize = $state<[number, number]>([1200, 800]);
  runtimeStartCommands = $state<Record<string, unknown>[]>([]);
  canvasPanelTab = $state<CanvasPanelTab>('canvas');
  workspaceMode = $state<WorkspaceMode>(readStored(STORAGE_KEYS.workspaceMode) === 'practice' ? 'practice' : 'studio');
  practiceChallengeId = $state(readStored(STORAGE_KEYS.practiceChallengeId) || PRACTICE_CHALLENGES[0].id);
  practiceAnswerVisible = $state(false);
  practiceVerification = $state<PracticeVerification | null>(null);
  practiceCompletedIds = $state<Set<string>>(readStoredSet(STORAGE_KEYS.practiceCompleted));
  practiceStepsExpanded = $state(readStored(STORAGE_KEYS.practiceStepsExpanded) !== '0');
  lastExampleId = $state<string | null>(readStored(STORAGE_KEYS.lastExampleId) || null);
  tourCompletedIds = $state<Set<string>>(readStoredSet(STORAGE_KEYS.tourCompleted));
  tourLessonExpanded = $state(true);

  sidebarCollapsed = $state(readStored(STORAGE_KEYS.sidebarCollapsed) === '1');
  consoleHeight = $state(readStoredNumber(STORAGE_KEYS.consoleHeight, 160));
  editorPanelWidth = $state(readStoredNumber(STORAGE_KEYS.editorPanelWidth, 520));
  consoleFilter = $state<'all' | 'stdout' | 'stderr'>('all');
  consoleEntries = $state<ConsoleEntry[]>([]);
  activeModal = $state<ModalName>(null);
  newFileName = $state('');
  gifDuration = $state('3');
  exampleCategory = $state('All');
  renamingProject = $state(false);
  runNonce = $state(0);

  private booted = false;
  private unsavedResolver: ((decision: UnsavedDecision) => void) | null = null;
  private exportPngHandler: (() => void) | null = null;
  private exportGifHandler: ((durationSeconds: number) => void) | null = null;
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private interactiveRuntimeRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private debugStepHoldTimer: ReturnType<typeof setInterval> | null = null;
  private dirtyRevision = 0;
  private consoleEntryId = 0;
  private runtimeRefreshWanted = false;
  private structuredStdoutFormatter = new StructuredConsoleFormatter();
  private projectSession = new ProjectSessionController(browserGateway);
  private runtimeCoordinator = new RuntimeCoordinator(browserGateway);

  get activeFile(): SketchFile {
    return this.files.find((file) => file.name === this.activeFileName) ?? this.files[0];
  }

  get activeEditorKey() {
    return this.workspaceMode === 'practice' ? `${PRACTICE_FILE_NAME}:${this.practiceChallengeId}` : this.activeFileName;
  }

  get activeEditorValue() {
    return this.workspaceMode === 'practice' ? this.practiceSource : (this.activeFile?.content ?? '');
  }

  get filteredConsole() {
    return this.consoleFilter === 'all'
      ? this.consoleEntries
      : this.consoleEntries.filter((entry) => entry.type === this.consoleFilter);
  }

  get running() {
    return isRuntimeActive(this.runtimeControl);
  }

  get paused() {
    return isRuntimePaused(this.runtimeControl);
  }

  get runtimeTransitioning() {
    return isRuntimeTransitioning(this.runtimeControl);
  }

  get debugPendingSteps() {
    return this.runtimeControl.pendingSteps;
  }

  get debugFrameNumber() {
    return this.runtimeControl.frameNumber;
  }

  get exampleCategories() {
    return ['All', ...new Set(EXAMPLES.map((example) => example.category))];
  }

  get filteredExamples() {
    return EXAMPLES.filter((example) => this.exampleCategory === 'All' || example.category === this.exampleCategory);
  }

  get practiceChallenges() {
    return PRACTICE_CHALLENGES;
  }

  get activePracticeChallenge() {
    return getPracticeChallenge(this.practiceChallengeId);
  }

  get activePracticeSolution() {
    return getPracticeSolutionSource(this.practiceChallengeId);
  }

  get activePracticeNeighbours() {
    return getPracticeChallengeNeighbours(this.practiceChallengeId);
  }

  get practiceCompletedCount() {
    return this.practiceCompletedIds.size;
  }

  isPracticeCompleted(challengeId: string) {
    return this.practiceCompletedIds.has(challengeId);
  }

  markPracticeComplete(challengeId: string) {
    if (this.practiceCompletedIds.has(challengeId)) return;
    const next = new Set(this.practiceCompletedIds);
    next.add(challengeId);
    this.practiceCompletedIds = next;
    writeStoredSet(STORAGE_KEYS.practiceCompleted, next);
  }

  clearPracticeComplete(challengeId: string) {
    if (!this.practiceCompletedIds.has(challengeId)) return;
    const next = new Set(this.practiceCompletedIds);
    next.delete(challengeId);
    this.practiceCompletedIds = next;
    writeStoredSet(STORAGE_KEYS.practiceCompleted, next);
  }

  togglePracticeSteps() {
    this.practiceStepsExpanded = !this.practiceStepsExpanded;
    writeStored(STORAGE_KEYS.practiceStepsExpanded, this.practiceStepsExpanded ? '1' : '0');
  }

  gotoNextPractice() {
    const next = this.activePracticeNeighbours.next;
    if (next) this.setPracticeChallenge(next.id);
  }

  gotoPreviousPractice() {
    const previous = this.activePracticeNeighbours.previous;
    if (previous) this.setPracticeChallenge(previous.id);
  }

  get activeCompiledOutput() {
    return getCompiledOutputView(this.activeEditorValue);
  }

  initialize() {
    if (this.booted) return;
    this.booted = true;

    this.clearConsole(true);
    this.validateRuntime();
    if (this.workspaceMode === 'practice') {
      this.applyPracticeStarter();
    }
    void this.primeRuntimePath();
    void this.refreshProjectLibrary();

    browserGateway.runtime.onStdout((value) => this.handleRuntimeStdout(value));
    browserGateway.runtime.onStderr((value) => this.handleRuntimeError(value));
    browserGateway.runtime.onExit((code) => {
      this.runtimeCoordinator.handleRuntimeExit(this, code);
    });

    browserGateway.menu.onNewSketch(() => {
      void this.createNewSketch();
    });
    browserGateway.menu.onOpenProject(() => {
      this.openProjectsModal();
    });
    browserGateway.menu.onSave(() => {
      void this.saveProject(false);
    });
    browserGateway.menu.onSaveAs(() => {
      void this.saveProject(true);
    });
  }

  appendConsole(type: ConsoleType, text: string) {
    this.consoleEntryId += 1;
    this.consoleEntries = [...this.consoleEntries, { id: this.consoleEntryId, type, text, ts: Date.now() }].slice(-2000);
  }

  removeConsoleEntry(id: number) {
    this.consoleEntries = this.consoleEntries.filter((entry) => entry.id !== id);
  }

  setConsoleHeight(height: number) {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    const minH = 96;
    const maxH = Math.min(560, Math.max(minH + 40, Math.floor(vh * 0.58)));
    const clamped = Math.max(minH, Math.min(Math.round(height), maxH));
    this.consoleHeight = clamped;
    writeStored(STORAGE_KEYS.consoleHeight, String(clamped));
  }

  setEditorPanelWidth(width: number) {
    const workspaceEl = typeof document !== 'undefined' ? document.getElementById('workspace') : null;
    const workspaceW = workspaceEl?.getBoundingClientRect().width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200);
    const sidebarReserve = this.sidebarCollapsed ? 24 : 212;
    const minOther = 220;
    const rawMax = Math.max(0, Math.floor(workspaceW - sidebarReserve - minOther));
    const minPx = 280;
    const lo = Math.min(minPx, rawMax);
    const hi = rawMax;
    const clamped = Math.min(hi, Math.max(lo, Math.round(width)));
    this.editorPanelWidth = clamped;
    writeStored(STORAGE_KEYS.editorPanelWidth, String(clamped));
  }

  clearConsole(withWelcome = false) {
    this.structuredStdoutFormatter.flush();
    this.consoleEntries = [];
    if (withWelcome) {
      this.appendConsole('info', 'Qanvas5 ready. Create, open, or run a sketch to get started.');
    }
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    writeStored(STORAGE_KEYS.sidebarCollapsed, this.sidebarCollapsed ? '1' : '0');
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        this.setEditorPanelWidth(this.editorPanelWidth);
      });
    }
  }

  setCanvasPanelTab(tab: CanvasPanelTab) {
    this.canvasPanelTab = tab;
  }

  toggleFps() {
    this.runtimeCoordinator.toggleFps(this);
  }

  toggleDebugConsole() {
    this.debugConsole = !this.debugConsole;
    writeStored(STORAGE_KEYS.debugConsole, this.debugConsole ? '1' : '0');
    this.appendConsole('info', this.debugConsole ? 'Debug console enabled.' : 'Debug console disabled.');
  }

  async setWorkspaceMode(mode: WorkspaceMode) {
    if (mode === this.workspaceMode && mode !== 'practice') return;

    if (this.running) {
      await this.stopSketch(true);
    }

    this.workspaceMode = mode;
    writeStored(STORAGE_KEYS.workspaceMode, mode);
    this.practiceAnswerVisible = false;
    this.practiceVerification = null;

    if (mode === 'practice') {
      this.applyPracticeStarter();
    }
  }

  setPracticeChallenge(challengeId: string) {
    this.practiceChallengeId = getPracticeChallenge(challengeId).id;
    writeStored(STORAGE_KEYS.practiceChallengeId, this.practiceChallengeId);
    this.practiceAnswerVisible = false;
    this.practiceVerification = null;
    if (this.workspaceMode === 'practice') {
      this.applyPracticeStarter();
    }
  }

  startProjectRename() {
    this.projectSession.startProjectRename(this);
  }

  finishProjectRename(commit: boolean) {
    this.projectSession.finishProjectRename(this, commit);
  }

  setProjectName(value: string, persist = true) {
    this.projectName = value.trim() || DEFAULT_PROJECT_NAME;
    this.projectNameDraft = this.projectName;
    if (persist) {
      writeStored(STORAGE_KEYS.projectName, this.projectName);
    }
  }

  updateActiveEditorContent(content: string, options: { restartRuntime?: boolean } = {}) {
    if (this.workspaceMode === 'practice') {
      if (this.practiceSource === content) return;
      this.practiceSource = content;
      this.practiceVerification = null;
      return;
    }

    if (!this.projectSession.updateActiveFileContent(this, content)) return;
    this.practiceVerification = null;
    this.markDirty({ refreshRuntime: !options.restartRuntime });

    if (options.restartRuntime) {
      this.scheduleInteractiveRuntimeRefresh();
    }
  }

  selectFile(name: string) {
    this.activeFileName = name;
  }

  openNewFileModal() {
    this.newFileName = '';
    this.activeModal = 'new-file';
  }

  openProjectsModal() {
    this.activeModal = 'projects';
    void this.refreshProjectLibrary();
  }

  closeModal(name?: ModalName) {
    if (!name || this.activeModal === name) {
      this.activeModal = null;
    }
  }

  registerCanvasExports(png: (() => void) | null, gif: ((durationSeconds: number) => void) | null) {
    this.exportPngHandler = png;
    this.exportGifHandler = gif;
  }

  createFile() {
    if (!this.projectSession.createFile(this)) return;
    this.activeModal = null;
  }

  renameFile(oldName: string, newName: string) {
    this.projectSession.renameFile(this, oldName, newName);
  }

  deleteFile(name: string) {
    this.projectSession.deleteFile(this, name);
  }

  async importAssets() {
    await this.projectSession.importAssets(this);
  }

  async detectRuntime() {
    await this.runtimeCoordinator.detectRuntime(this);
  }

  saveSettings() {
    this.runtimeCoordinator.saveSettings(this);
    writeStored(STORAGE_KEYS.runtimePath, this.runtimePath);
    this.activeModal = null;
  }

  validateRuntime() {
    this.runtimeCoordinator.validateRuntime(this);
  }

  async confirmUnsaved() {
    if (!this.unsaved) return 'continue' as const;
    this.activeModal = 'unsaved';

    return new Promise<UnsavedDecision>((resolve) => {
      this.unsavedResolver = resolve;
    });
  }

  resolveUnsaved(decision: UnsavedDecision) {
    this.activeModal = null;
    this.unsavedResolver?.(decision);
    this.unsavedResolver = null;
  }

  async saveFromUnsavedModal() {
    const saved = await this.saveProject(false);
    this.resolveUnsaved(saved ? 'continue' : 'cancel');
  }

  async createNewSketch(template = DEFAULT_SKETCH, name = this.generateSketchName()) {
    const decision = await this.confirmUnsaved();
    if (decision === 'cancel') return false;

    await this.resetStudioProject(template, name, { unsaved: true, dirtyRevision: 1 });
    this.appendConsole('info', `New sketch: ${this.projectName}`);
    return true;
  }

  async loadExample(exampleId: string) {
    const example = EXAMPLES.find((entry) => entry.id === exampleId);
    if (!example) return;

    if (!this.canReplaceCurrentSketchWithoutPrompt()) {
      const decision = await this.confirmUnsaved();
      if (decision === 'cancel') return;
    }

    await this.resetStudioProject(example.code, example.name, { unsaved: false, dirtyRevision: 0 });
    this.setLastExampleId(example.id);
    this.appendConsole('info', `Loaded example: ${example.name}`);
    this.activeModal = null;
  }

  private setLastExampleId(id: string | null) {
    this.lastExampleId = id;
    if (id) {
      writeStored(STORAGE_KEYS.lastExampleId, id);
    } else {
      try { localStorage.removeItem(STORAGE_KEYS.lastExampleId); } catch { /* ignore */ }
    }
  }

  get nextTourExample() {
    return getNextTourExample(this.lastExampleId);
  }

  get previousTourExample() {
    return getPreviousTourExample(this.lastExampleId);
  }

  get currentTourExample() {
    return this.lastExampleId ? (getExampleById(this.lastExampleId) ?? null) : null;
  }

  get isOnTour() {
    return isTourExample(this.lastExampleId);
  }

  get tourLength() {
    return GUIDED_TOUR_IDS.length;
  }

  get currentTourStep() {
    if (!this.lastExampleId) return 0;
    const index = GUIDED_TOUR_IDS.indexOf(this.lastExampleId);
    return index < 0 ? 0 : index + 1;
  }

  get tourCompletedCount() {
    return this.tourCompletedIds.size;
  }

  get tourFinished() {
    return this.tourCompletedIds.size >= GUIDED_TOUR_IDS.length;
  }

  isTourLessonCompleted(id: string) {
    return this.tourCompletedIds.has(id);
  }

  markTourLessonComplete(id: string | null) {
    if (!id || !isTourExample(id)) return;
    if (this.tourCompletedIds.has(id)) return;
    const next = new Set(this.tourCompletedIds);
    next.add(id);
    this.tourCompletedIds = next;
    writeStoredSet(STORAGE_KEYS.tourCompleted, next);
  }

  toggleTourLessonPanel() {
    this.tourLessonExpanded = !this.tourLessonExpanded;
  }

  async loadNextTourExample() {
    this.markTourLessonComplete(this.lastExampleId);
    const next = this.nextTourExample;
    if (!next) return;
    await this.loadExample(next.id);
    await this.runSketch();
  }

  /** Start the tour, advance to the next lesson, or restart after completion — used by the canvas toolbar control. */
  async startOrContinueGuidedTour() {
    if (this.tourFinished) {
      await this.restartTour();
      await this.runSketch();
      return;
    }
    if (this.nextTourExample) {
      await this.loadNextTourExample();
      return;
    }
    await this.restartTour();
    await this.runSketch();
  }

  async loadPreviousTourExample() {
    const previous = this.previousTourExample;
    if (!previous) return;
    await this.loadExample(previous.id);
    await this.runSketch();
  }

  async restartTour() {
    const first = getExampleById(GUIDED_TOUR_IDS[0]);
    if (!first) return;
    const next = new Set<string>();
    this.tourCompletedIds = next;
    writeStoredSet(STORAGE_KEYS.tourCompleted, next);
    await this.loadExample(first.id);
  }

  async openProject(projectPath: string) {
    const decision = await this.confirmUnsaved();
    if (decision === 'cancel') return;

    const snapshot = await this.projectSession.readProject(projectPath);
    this.loadProject(snapshot);
    this.activeModal = null;
  }

  loadProject(snapshot: ProjectSnapshot) {
    this.projectSession.loadProject(this, snapshot, DEFAULT_SKETCH);
    this.dirtyRevision = 0;
    this.runtimeRefreshWanted = false;
    this.overlayMessage = '';
    this.overlayMode = this.runtimeOk ? 'idle' : 'runtime-missing';
  }

  async saveProject(forceChoosePath: boolean, options: { silent?: boolean } = {}) {
    const revisionAtStart = this.dirtyRevision;
    const snapshot = await this.projectSession.saveProject(this, forceChoosePath, {
      silent: options.silent,
      onSaved: () => {
        void this.refreshProjectLibrary();
      },
    });

    if (revisionAtStart === this.dirtyRevision) {
      this.unsaved = false;
    }

    return Boolean(snapshot);
  }

  async runSketch() {
    this.clearConsole();
    if (this.workspaceMode === 'practice') {
      await this.verifyPracticeAnswer();
      return;
    }

    await this.runtimeCoordinator.runProject(this, this.getRuntimeProjectSource());
    this.markTourLessonComplete(this.lastExampleId);
  }

  async stepSketch() {
    if (this.workspaceMode !== 'studio') return;

    await this.runtimeCoordinator.stepProject(this, this.getRuntimeProjectSource());
  }

  startStepHold() {
    if (this.workspaceMode !== 'studio' || this.debugStepHoldTimer) return;

    this.debugStepHoldTimer = setInterval(() => {
      void this.stepSketch();
    }, 120);
  }

  stopStepHold() {
    if (!this.debugStepHoldTimer) return;
    clearInterval(this.debugStepHoldTimer);
    this.debugStepHoldTimer = null;
  }

  async verifyPracticeAnswer() {
    const challenge = this.activePracticeChallenge;
    this.practiceVerification = null;

    try {
      if (!this.runtimeOk) {
        await this.primeRuntimePath();
        if (!this.runtimeOk) {
          this.practiceVerification = {
            status: 'error',
            actual: null,
            expected: challenge.expected,
            message: 'Configure the q runtime before verifying practice answers.',
          };
          return;
        }
      }

      const runtimeFiles = this.workspaceMode === 'practice'
        ? [{ name: PRACTICE_FILE_NAME, content: this.practiceSource }]
        : this.files.filter((file) => file.name.endsWith('.q'));
      const result = await browserGateway.runtime.query({
        runtimePath: this.runtimePath,
        files: runtimeFiles.map((file) => ({ ...file })),
        expression: challenge.answerExpression,
        debugConsole: this.debugConsole,
      });

      if (!result.ok) {
        this.practiceVerification = {
          status: 'error',
          actual: null,
          expected: challenge.expected,
          message: result.error || 'Verification failed.',
        };
        this.appendConsole('stderr', result.error || 'Verification failed.');
        return;
      }

      const matches = stableValue(result.value) === stableValue(challenge.expected);
      this.practiceVerification = {
        status: matches ? 'match' : 'mismatch',
        actual: result.value,
        expected: challenge.expected,
        message: matches ? 'Answer matches the expected output.' : 'Output is valid q data, but it does not match the expected answer yet.',
      };
      if (matches) {
        this.markPracticeComplete(challenge.id);
      }
      this.appendConsole('info', matches ? `Verified: ${challenge.title}` : `Checked: ${challenge.title}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.practiceVerification = {
        status: 'error',
        actual: null,
        expected: challenge.expected,
        message,
      };
      this.appendConsole('stderr', message);
    }
  }

  exportPng() {
    if (!this.exportPngHandler) {
      this.appendConsole('stderr', 'No canvas to export. Run the sketch first.');
      return;
    }

    this.exportPngHandler();
    this.appendConsole('info', 'PNG exported.');
  }

  openGifModal() {
    if (!this.running) {
      this.appendConsole('stderr', 'Sketch must be running to export GIF.');
      return;
    }

    this.gifDuration = '3';
    this.activeModal = 'export-gif';
  }

  startGifExport() {
    if (!this.exportGifHandler) {
      this.appendConsole('stderr', 'GIF export is unavailable until the canvas is running.');
      return;
    }

    const seconds = Number.parseInt(this.gifDuration, 10) || 3;
    this.activeModal = null;
    this.exportGifHandler(seconds);
  }

  async stopSketch(quiet = false) {
    this.stopStepHold();
    this.clearInteractiveRuntimeRefresh();
    this.runtimeRefreshWanted = false;
    await this.runtimeCoordinator.stopRuntime(this, true);
    if (!quiet) {
      this.clearConsole(false);
      this.overlayMode = 'stopped';
    }
  }

  pauseSketch() {
    this.runtimeCoordinator.pauseSketch(this);
  }

  handleRuntimeError(message: string) {
    this.runtimeCoordinator.handleRuntimeError(this, message);
  }

  setCanvasSize(size: [number, number]) {
    this.runtimeCoordinator.setCanvasSize(this, size);
  }

  setFps(value: number) {
    this.runtimeCoordinator.setFps(this, value);
  }

  recordRenderedFrame(kind: RuntimeFrameKind) {
    this.runtimeCoordinator.recordRenderedFrame(this, kind);
  }

  completeDebugStep() {
    this.runtimeCoordinator.completeDebugStep(this);
  }

  generateSketchName() {
    let candidate = DEFAULT_PROJECT_NAME;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const adjective = SKETCH_ADJECTIVES[Math.floor(Math.random() * SKETCH_ADJECTIVES.length)];
      const noun = SKETCH_NOUNS[Math.floor(Math.random() * SKETCH_NOUNS.length)];
      candidate = `${adjective}-${noun}`;
      if (candidate !== this.projectName) break;
    }
    return candidate;
  }

  private async refreshProjectLibrary() {
    await this.projectSession.refreshProjectLibrary(this);
  }

  private async primeRuntimePath() {
    const updated = await this.runtimeCoordinator.primeRuntimePath(this);
    if (updated) {
      writeStored(STORAGE_KEYS.runtimePath, this.runtimePath);
    }
  }

  markDirty(options: { refreshRuntime?: boolean } = {}) {
    this.dirtyRevision += 1;
    this.unsaved = true;

    if (options.refreshRuntime && this.running) {
      this.runtimeRefreshWanted = true;
    }

    this.scheduleAutosave();
  }

  clearAutosave() {
    if (!this.autosaveTimer) return;
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = null;
  }

  clearInteractiveRuntimeRefresh() {
    if (!this.interactiveRuntimeRefreshTimer) return;
    clearTimeout(this.interactiveRuntimeRefreshTimer);
    this.interactiveRuntimeRefreshTimer = null;
  }

  private scheduleAutosave() {
    if (!this.projectPath) return;

    this.clearAutosave();
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null;
      void this.flushAutosave();
    }, 450);
  }

  private async flushAutosave() {
    if (!this.projectPath || !this.unsaved) return;

    const revisionAtStart = this.dirtyRevision;
    const saved = await this.saveProject(false, { silent: true });
    if (!saved) return;

    if (revisionAtStart !== this.dirtyRevision) {
      this.scheduleAutosave();
      return;
    }

    if (this.runtimeRefreshWanted && this.running) {
      this.runtimeRefreshWanted = false;
      await this.runtimeCoordinator.runProject(this, this.getRuntimeProjectSource(), '↻ Live update');
    }
  }

  private scheduleInteractiveRuntimeRefresh() {
    this.runtimeRefreshWanted = false;
    if (this.workspaceMode !== 'studio' || !this.running) {
      return;
    }

    this.clearInteractiveRuntimeRefresh();
    this.interactiveRuntimeRefreshTimer = setTimeout(() => {
      this.interactiveRuntimeRefreshTimer = null;
      if (this.workspaceMode !== 'studio' || !this.running) {
        return;
      }

      this.runtimeRefreshWanted = false;
      void this.runtimeCoordinator.runProject(this, this.getRuntimeProjectSource(), '↻ Live tweak');
    }, 60);
  }

  private applyPracticeStarter() {
    const challenge = this.activePracticeChallenge;
    this.practiceSource = challenge.starterCode;
    this.practiceAnswerVisible = false;
    this.practiceVerification = null;
    this.appendConsole('info', `Loaded practice starter: ${challenge.title}`);
  }

  revealPracticeAnswer() {
    this.practiceAnswerVisible = true;
  }

  hidePracticeAnswer() {
    this.practiceAnswerVisible = false;
  }

  loadPracticeAnswer() {
    this.practiceSource = this.activePracticeSolution;
    this.practiceAnswerVisible = true;
    this.practiceVerification = null;
    this.appendConsole('info', `Loaded practice answer: ${this.activePracticeChallenge.title}`);
  }

  resetPracticeStarter() {
    this.applyPracticeStarter();
  }

  private handleRuntimeStdout(value: string) {
    for (const entry of this.structuredStdoutFormatter.push(value)) {
      this.appendConsole('stdout', entry);
    }
  }

  flushPendingStructuredStdout() {
    for (const entry of this.structuredStdoutFormatter.flush()) {
      this.appendConsole('stdout', entry);
    }
  }

  private getRuntimeProjectSource(): RuntimeProjectSource {
    return {
      projectPath: this.projectPath,
      activeFileName: this.activeFileName,
      files: this.files.filter((file) => file.name.endsWith('.q')),
    };
  }

  private canReplaceCurrentSketchWithoutPrompt() {
    if (!this.unsaved) {
      return true;
    }

    if (this.workspaceMode !== 'studio' || this.projectPath || this.assets.length > 0 || this.files.length !== 1) {
      return false;
    }

    return EXAMPLES.some((example) =>
      this.files[0]?.name === 'sketch.q' &&
      this.files[0]?.content === example.code
    );
  }

  private async resetStudioProject(
    template: string,
    name: string,
    options: { unsaved: boolean; dirtyRevision: number }
  ) {
    await this.stopSketch(true);
    this.clearInteractiveRuntimeRefresh();
    this.projectSession.resetProject(this, template, name);
    this.unsaved = options.unsaved;
    this.dirtyRevision = options.dirtyRevision;
    this.runtimeRefreshWanted = false;
    this.overlayMessage = '';
    this.overlayMode = this.runtimeOk ? 'idle' : 'runtime-missing';
  }
}

export const appState = new AppState();

function stableValue(value: unknown) {
  return JSON.stringify(value, (_key, entry) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return Object.fromEntries(Object.entries(entry as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)));
    }
    return entry;
  });
}
