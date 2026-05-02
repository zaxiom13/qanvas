/** Human-readable copy for where browser / in-app projects live. */

export function projectsLibraryBlurb(
  projectsRoot: string,
  loading: boolean
): { primary: string; code?: string } {
  if (loading && !projectsRoot.trim()) {
    return { primary: 'Loading where sketches are stored…' };
  }

  const root = projectsRoot.trim();
  if (!root) {
    return { primary: 'Sketches are saved on this device.' };
  }

  if (root.startsWith('browser://')) {
    return {
      primary: 'Sketches are saved in this browser (local storage on this device).',
      code: root === 'browser://projects' ? undefined : root,
    };
  }

  return {
    primary: 'All sketches save under:',
    code: root,
  };
}

/** Second line on a project card: hide noisy internal paths where a short hint is enough. */
export function projectCardSubtitle(projectPath: string): string | null {
  if (!projectPath.trim()) return null;
  if (projectPath.startsWith('browser://')) return 'This device';
  return projectPath;
}
