export function resolveCommit(env?: NodeJS.ProcessEnv): string;
export function versionPayload(env?: NodeJS.ProcessEnv, now?: Date): { commit: string; builtAt: string };
export function versionJsonPlugin(): { name: string; apply: "build"; generateBundle: () => void };
