/** Shared Q literal serialization for sketch frame/input/canvas payloads. */

export function rewriteQanvasCompat(source: string) {
  return source.replace(/\b0x([0-9a-fA-F]{1,8})\b/g, (_match, hex: string) => `${Number.parseInt(hex, 16)}`);
}

export function toQLiteral(value: unknown): string {
  if (value === null || value === undefined) return '()';

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '0n';
    return Number.isInteger(value) ? `${value}` : `${value}`;
  }

  if (typeof value === 'boolean') {
    return value ? '1b' : '0b';
  }

  if (typeof value === 'string') {
    return qString(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '()';
    return `(${value.map((entry) => toQLiteral(entry)).join(';')})`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return '()!()';
    }

    if (entries.length === 1) {
      const [key, entry] = entries[0]!;
      return `enlist \`${sanitizeSymbol(key)}!enlist ${toQLiteral(entry)}`;
    }

    const keys = entries.map(([key]) => `\`${sanitizeSymbol(key)}`).join('');
    const values = `(${entries.map(([, entry]) => toQLiteral(entry)).join(';')})`;
    return `${keys}!${values}`;
  }

  return '()';
}

function sanitizeSymbol(value: string) {
  return value.replace(/[^\w]/g, '_');
}

function qString(value: string) {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}
