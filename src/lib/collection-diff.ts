export type Row = Record<string, unknown> & { id: string };
export type RowChange =
  | { kind: 'insert'; row: Row }
  | { kind: 'update'; id: string; version: number; patch: Record<string, unknown> }
  | { kind: 'delete'; id: string; version: number };

/** Compare the exact snapshot displayed by the editor, never a fresh server list. */
export function collectionChanges<T extends { id: string; version?: number }>(
  previous: T[], next: T[], toRow: (item: T) => Row,
): RowChange[] {
  const oldById = new Map(previous.map(item => [item.id, item]));
  const nextById = new Map(next.map(item => [item.id, item]));
  if (nextById.size !== next.length) throw new Error('Duplicate record ID');
  const changes: RowChange[] = [];
  for (const item of next) {
    const old = oldById.get(item.id);
    const row = toRow(item);
    if (!old) { changes.push({ kind: 'insert', row }); continue; }
    const before = toRow(old);
    const patch = Object.fromEntries(Object.entries(row).filter(([key, value]) =>
      key !== 'id' && key !== 'row_version' && value !== undefined &&
      Object.prototype.hasOwnProperty.call(before, key) && JSON.stringify(value) !== JSON.stringify(before[key]),
    ));
    if (Object.keys(patch).length) {
      if (old.version === undefined || item.version === undefined) throw new Error('Reload this record before editing');
      if (item.version !== old.version) throw new Error('STALE_RECORD');
      changes.push({ kind: 'update', id: item.id, version: old.version, patch });
    }
  }
  for (const old of previous) {
    if (!nextById.has(old.id)) {
      if (old.version === undefined) throw new Error('Reload this record before deleting');
      changes.push({ kind: 'delete', id: old.id, version: old.version });
    }
  }
  return changes;
}
