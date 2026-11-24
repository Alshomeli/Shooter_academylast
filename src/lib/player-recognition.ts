/** Private recognition uses stable player IDs, never names. The caller supplies only authorized children. */
export function isRecognizedChild(featuredPlayerId: string | undefined, childIds: readonly string[]): boolean {
  const id = featuredPlayerId?.trim();
  return Boolean(id && childIds.includes(id));
}
