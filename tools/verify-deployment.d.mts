export const deployment: { repo: string; branch: string; url: string };
export function expectedCommit(): Promise<string>;
export function liveVersion(): Promise<{ commit?: string; builtAt?: string; error?: string }>;
export function verifyDeployment(): Promise<void>;
