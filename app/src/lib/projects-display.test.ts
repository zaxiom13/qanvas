import { describe, expect, it } from 'vitest';
import { projectCardSubtitle, projectsLibraryBlurb } from './projects-display';

describe('projectsLibraryBlurb', () => {
  it('shows loading when library is loading and root is empty', () => {
    expect(projectsLibraryBlurb('', true).primary).toMatch(/Loading/);
  });

  it('describes browser storage and omits redundant default root code', () => {
    const b = projectsLibraryBlurb('browser://projects', false);
    expect(b.primary).toMatch(/browser/i);
    expect(b.code).toBeUndefined();
  });

  it('shows non-default browser root as code for debugging', () => {
    const b = projectsLibraryBlurb('browser://custom-root', false);
    expect(b.code).toBe('browser://custom-root');
  });

  it('shows folder-style roots as code', () => {
    const b = projectsLibraryBlurb('/Users/me/qanvas-projects', false);
    expect(b.primary).toMatch(/under/);
    expect(b.code).toContain('qanvas-projects');
  });
});

describe('projectCardSubtitle', () => {
  it('maps browser virtual paths to a short hint', () => {
    expect(projectCardSubtitle('browser://projects/foo-bar-abc')).toBe('This device');
  });

  it('passes through real paths', () => {
    expect(projectCardSubtitle('/data/sketch')).toBe('/data/sketch');
  });

  it('returns null for empty', () => {
    expect(projectCardSubtitle('')).toBeNull();
  });
});
