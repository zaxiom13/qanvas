export type RuntimeControlMode = 'idle' | 'starting' | 'running' | 'paused' | 'stopping' | 'error';
export type RuntimeStartMode = 'run' | 'step';
export type RuntimeFrameKind = 'continuous' | 'manual';

export type RuntimeControlState = {
  mode: RuntimeControlMode;
  frameNumber: number;
  pendingSteps: number;
  startMode: RuntimeStartMode | null;
};

export function createRuntimeControlState(): RuntimeControlState {
  return {
    mode: 'idle',
    frameNumber: 0,
    pendingSteps: 0,
    startMode: null,
  };
}

export function isRuntimeActive(state: RuntimeControlState) {
  return state.mode === 'running' || state.mode === 'paused';
}

export function isRuntimePaused(state: RuntimeControlState) {
  return state.mode === 'paused';
}

export function isRuntimeTransitioning(state: RuntimeControlState) {
  return state.mode === 'starting' || state.mode === 'stopping';
}

export function hasLiveRuntimeSession(state: RuntimeControlState) {
  return isRuntimeActive(state) || isRuntimeTransitioning(state);
}

export function beginRuntimeStart(_state: RuntimeControlState, startMode: RuntimeStartMode): RuntimeControlState {
  return {
    mode: 'starting',
    frameNumber: 0,
    pendingSteps: 0,
    startMode,
  };
}

export function completeRuntimeStart(state: RuntimeControlState): RuntimeControlState {
  if (state.mode !== 'starting') {
    return state;
  }

  return {
    mode: state.startMode === 'step' ? 'paused' : 'running',
    frameNumber: 0,
    pendingSteps: 0,
    startMode: null,
  };
}

export function beginRuntimeStop(state: RuntimeControlState): RuntimeControlState {
  if (!hasLiveRuntimeSession(state)) {
    return state;
  }

  return {
    mode: 'stopping',
    frameNumber: state.frameNumber,
    pendingSteps: 0,
    startMode: null,
  };
}

export function completeRuntimeStop(_state: RuntimeControlState): RuntimeControlState {
  return createRuntimeControlState();
}

export function pauseRuntime(state: RuntimeControlState): RuntimeControlState {
  if (state.mode !== 'running') {
    return state;
  }

  return {
    ...state,
    mode: 'paused',
    pendingSteps: 0,
  };
}

export function resumeRuntime(state: RuntimeControlState): RuntimeControlState {
  if (state.mode !== 'paused') {
    return state;
  }

  return {
    ...state,
    mode: 'running',
    pendingSteps: 0,
  };
}

export function queueRuntimeStep(state: RuntimeControlState): RuntimeControlState {
  if (state.mode === 'running') {
    return {
      ...state,
      mode: 'paused',
      pendingSteps: 1,
    };
  }

  if (state.mode === 'paused') {
    return {
      ...state,
      pendingSteps: state.pendingSteps + 1,
    };
  }

  return state;
}

export function recordRuntimeFrame(state: RuntimeControlState, _kind: RuntimeFrameKind): RuntimeControlState {
  if (!isRuntimeActive(state)) {
    return state;
  }

  return {
    ...state,
    frameNumber: state.frameNumber + 1,
  };
}

export function completeQueuedRuntimeStep(state: RuntimeControlState): RuntimeControlState {
  if (state.mode !== 'paused') {
    return state;
  }

  return {
    ...state,
    pendingSteps: Math.max(0, state.pendingSteps - 1),
  };
}

export function failRuntime(_state: RuntimeControlState): RuntimeControlState {
  return {
    mode: 'error',
    frameNumber: 0,
    pendingSteps: 0,
    startMode: null,
  };
}

export function exitRuntime(_state: RuntimeControlState): RuntimeControlState {
  return createRuntimeControlState();
}
