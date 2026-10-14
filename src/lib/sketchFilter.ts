/** Sketches whose name contains `query`, ignoring case and surrounding spaces. An empty query keeps the list. */
export function filterByName<T extends { name: string }>(items: readonly T[], query: string): readonly T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((s) => s.name.toLowerCase().includes(q));
}
