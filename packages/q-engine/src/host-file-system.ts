export interface HostFileSystem {
  readText: (path: string) => string | null;
  writeText: (path: string, contents: string) => void;
  readBinary?: (path: string) => Uint8Array | null;
  writeBinary?: (path: string, bytes: Uint8Array) => void;
  deletePath: (path: string) => boolean;
  list: (directory: string) => string[];
  exists: (path: string) => boolean;
  size?: (path: string) => number;
}

const normalizeMemoryPath = (path: string): string => path.replace(/^:+/, "").replace(/^\/+/, "");

export const createMemoryFileSystem = (): HostFileSystem => {
  const files = new Map<string, string>();
  const binaries = new Map<string, Uint8Array>();

  const collectEntry = (entries: Set<string>, directory: string, name: string) => {
    if (!directory) {
      entries.add(name.split("/")[0]!);
      return;
    }
    if (name === directory) {
      entries.add(name);
      return;
    }
    if (name.startsWith(`${directory}/`)) {
      entries.add(name.slice(directory.length + 1).split("/")[0]!);
    }
  };

  return {
    readText: (path) => files.get(normalizeMemoryPath(path)) ?? null,
    writeText: (path, contents) => {
      const key = normalizeMemoryPath(path);
      files.set(key, contents);
      binaries.delete(key);
    },
    readBinary: (path) => binaries.get(normalizeMemoryPath(path)) ?? null,
    writeBinary: (path, bytes) => {
      const key = normalizeMemoryPath(path);
      binaries.set(key, bytes);
      files.delete(key);
    },
    deletePath: (path) => {
      const key = normalizeMemoryPath(path);
      return files.delete(key) || binaries.delete(key);
    },
    list: (directory) => {
      const normalizedDirectory = normalizeMemoryPath(directory);
      const entries = new Set<string>();
      for (const name of files.keys()) collectEntry(entries, normalizedDirectory, name);
      for (const name of binaries.keys()) collectEntry(entries, normalizedDirectory, name);
      return [...entries].sort();
    },
    exists: (path) => {
      const key = normalizeMemoryPath(path);
      return files.has(key) || binaries.has(key);
    },
    size: (path) => {
      const key = normalizeMemoryPath(path);
      if (files.has(key)) return files.get(key)!.length;
      if (binaries.has(key)) return binaries.get(key)!.byteLength;
      return -1;
    }
  };
};
