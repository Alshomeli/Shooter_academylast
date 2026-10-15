interface PreviewableContent {
  id: string;
  sort_order: number;
  payload: Record<string, string>;
}

/**
 * The preview resolves private image/video paths to temporary signed URLs.
 * Compare the original storage paths rather than those generated URLs.
 */
export function hasReviewedCurrentDraft(draft: PreviewableContent | null, preview: PreviewableContent | null): boolean {
  if (!draft || !preview || draft.id !== preview.id || draft.sort_order !== preview.sort_order) return false;
  return Object.entries(draft.payload).every(([key, value]) => {
    if (['image', 'video', 'poster', 'featured_image'].includes(key) && draft.payload[`${key}_path`]) return true;
    return preview.payload[key] === value;
  });
}
