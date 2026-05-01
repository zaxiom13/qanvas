export type WorkspaceMode = 'studio' | 'practice';

export type UxTourAdvanceMode = 'next' | 'click-target';

export type MobileShellTabPrep = 'editor' | 'canvas' | 'examples' | 'settings';

export type UxTourStepDefinition = {
  id: string;
  /** CSS selector for spotlight; omit for centered intro only */
  target?: string | null;
  title: string;
  body: string;
  advance: UxTourAdvanceMode;
  /** MobileShell tab to focus before resolving the spotlight */
  prepareTab?: MobileShellTabPrep;
};

export function buildUxTourSteps(workspaceMode: WorkspaceMode, mobile: boolean): UxTourStepDefinition[] {
  if (mobile) return buildMobileTourSteps(workspaceMode);

  if (workspaceMode === 'practice') return buildDesktopPracticeSteps();
  return buildDesktopStudioSteps();
}

function buildDesktopStudioSteps(): UxTourStepDefinition[] {
  return [
    {
      id: 'info',
      target: '#btn-info',
      title: 'About & help',
      body: 'This button opens explanations, keyboard tips, and the guided tour anytime you need context.',
      advance: 'next',
    },
    {
      id: 'workspace',
      target: '#workspace-mode-switch',
      title: 'Studio ⇄ Practice',
      body: 'Studio is open-ended sketches with a live canvas. Practice is bite-sized exercises with prompts and checker output.',
      advance: 'next',
    },
    {
      id: 'project',
      target: '.project-info',
      title: 'Project name',
      body: 'Click the title to rename locally. Use the pencil for the same rename flow. Amber dot indicates unsaved changes.',
      advance: 'next',
    },
    {
      id: 'projects',
      target: '#btn-projects',
      title: 'Library',
      body: 'Open the project library—load recent work, autosaved copies, or files you have saved as a folder.',
      advance: 'next',
    },
    {
      id: 'examples',
      target: '#btn-examples',
      title: 'Examples',
      body: 'Browse curated sketches to learn patterns. Cmd+E jumps here from anywhere in the workspace.',
      advance: 'next',
    },
    {
      id: 'debug-console',
      target: '#btn-debug-console',
      title: 'Debug console',
      body: 'When lit, richer runtime instrumentation prints into the Console below—handy while iterating.',
      advance: 'next',
    },
    {
      id: 'settings',
      target: '#btn-settings',
      title: 'Settings',
      body: 'Point Qanvas at your q executable, tweak editor preferences, and flip canvas-related toggles.',
      advance: 'next',
    },
    {
      id: 'editor',
      target: '#editor-panel',
      title: 'Editor',
      body: 'Write q sketches here—syntax highlighting, slash snippets (/sketch, /circle, …), and CodeMirror ergonomics.',
      advance: 'next',
    },
    {
      id: 'tabs',
      target: '.file-tabs',
      title: 'Files tab strip',
      body: 'Switch between `.q` files, import images, rename, delete, or spin up blank files.',
      advance: 'next',
    },
    {
      id: 'run',
      target: '#btn-run-sketch, #mobile-btn-run',
      title: 'Run / Stop',
      body: 'Kick off the interpreter loop running your sketch, or halt it cleanly. Prefer trying it yourself—otherwise tap Next.',
      advance: 'click-target',
    },
    {
      id: 'step',
      target: '#btn-step',
      title: 'Step',
      body: 'Single-step through setup frames while debugging timing-sensitive logic. Hold the button to coast through repeats.',
      advance: 'next',
    },
    {
      id: 'new-file-upload',
      target: '.file-tab-actions',
      title: 'New files & assets',
      body: 'Add another `.q` buffer or pipe an uploaded image straight into `"assets/<name>"` references.',
      advance: 'next',
    },
    {
      id: 'canvas',
      target: '#canvas-panel',
      title: 'Canvas',
      body: 'The live stage for draw commands rendered from q. Hover the chip for FPS; use the sparkle menu for export tools.',
      advance: 'next',
    },
    {
      id: 'canvas-menu',
      target: '#btn-canvas-actions',
      title: 'Canvas actions menu',
      body: 'Snapshot PNG/GIF captures, revisit compile output tabs, or jump into gif recording flows.',
      advance: 'next',
    },
    {
      id: 'console',
      target: '#console-panel',
      title: 'Console',
      body: 'stdout/stderr/info streams filtered here—resize the rail, collapse it, or clear history while you iterate.',
      advance: 'next',
    },
  ];
}

function buildDesktopPracticeSteps(): UxTourStepDefinition[] {
  return [
    {
      id: 'info',
      target: '#btn-info',
      title: 'About & help',
      body: 'Revisit onboarding copy, tooling notes, or restart this walkthrough anytime from the About modal.',
      advance: 'next',
    },
    {
      id: 'workspace',
      target: '#workspace-mode-switch',
      title: 'Return to Studio',
      body: 'Flip back anytime for free-form sketches—the canvas swaps in automatically when Studio is selected.',
      advance: 'next',
    },
    {
      id: 'examples-lessons',
      target: '#btn-examples',
      title: 'Practice lessons',
      body: 'The grid icon exposes the practice catalog mirrored here plus Studio examples.',
      advance: 'next',
    },
    {
      id: 'settings',
      target: '#btn-settings',
      title: 'Runtime & tooling',
      body: 'Wire up your interpreter path plus editor toggles—you need a healthy runtime for exercises to verify.',
      advance: 'next',
    },
    {
      id: 'editor',
      target: '#editor-panel',
      title: 'Answer editor',
      body: 'This buffer is where you reshape the canonical answer before running verification.',
      advance: 'next',
    },
    {
      id: 'run-practice',
      target: '#btn-run-sketch, #mobile-btn-run',
      title: 'Run answer',
      body: 'Executes against the sandbox so you can iterate quickly. Prefer clicking Run yourself—otherwise use Next.',
      advance: 'click-target',
    },
    {
      id: 'practice-panel',
      target: '#practice-panel',
      title: 'Prompts & checks',
      body: 'Stories, datasets, graphs, hints, resets, reveal answer—everything for the guided exercise lives beside the editor.',
      advance: 'next',
    },
    {
      id: 'console-practice',
      target: '#console-panel',
      title: 'Practice console',
      body: 'Filters mirror Studio so you see errors (stderr), streamed tables (stdout), and meta lines discretely.',
      advance: 'next',
    },
  ];
}

function buildMobileTourSteps(workspaceMode: WorkspaceMode): UxTourStepDefinition[] {
  const workspaceBlurb =
    workspaceMode === 'practice'
      ? 'Practice concentrates on drills; Studio brings the painterly canvas tabs back.'
      : 'Studio keeps the Canvas tab live; Practice swaps it for verifier output. Flip modes from Settings ▸ Workspace.';
  return [
    {
      id: 'intro',
      target: null,
      title: 'Mobile layout',
      body: 'Editors, canvas/output, lesson/example browsers, and settings each get their own bottom tab—they mirror the desktop panes compactly.',
      advance: 'next',
    },
    {
      id: 'info',
      target: '#mobile-btn-info',
      title: 'Quick help',
      body: 'The same overview modal loads here—including the guided tour launcher you just tapped.',
      advance: 'next',
    },
    {
      id: 'nav',
      target: '.mobile-bottom-nav',
      title: 'Primary navigation',
      body: 'Use the bottom dock to bounce between coding, previews, catalogs, and global settings.',
      advance: 'next',
    },
    {
      id: 'filebar',
      target: '.mobile-filebar',
      title: 'Run tools',
      body: 'Run launches the sandbox; Step offers frame-by-frame passes. Nearby icons import images or scaffold new `.q` tabs.',
      advance: 'next',
      prepareTab: 'editor',
    },
    {
      id: 'run-mobile',
      target: '#btn-run-sketch, #mobile-btn-run',
      title: 'Try Run',
      body: 'Kick off verification or canvas loops from here—it is the fastest feedback loop on mobile.',
      advance: 'click-target',
      prepareTab: 'editor',
    },
    {
      id: 'workspace-mode',
      target: '#mobile-workspace-switch',
      title: 'Modes',
      body: workspaceBlurb,
      advance: 'next',
      prepareTab: 'settings',
    },
  ];
}
