// Marks errors that were crafted for display and may be shown to users verbatim.
export function isFriendlyError(error: unknown): boolean {
  return error instanceof Error && (error as FriendlyError).friendly === true;
}

type FriendlyError = Error & { friendly?: boolean };

function friendly(message: string): FriendlyError {
  const error: FriendlyError = new Error(message);
  error.friendly = true;
  return error;
}

// Map a raw error to a user-appropriate message: friendly errors (and Arabic
// text crafted by data-layer throwers) pass through; anything raw is replaced
// with a generic bilingual message so internals never reach the screen.
const FRIENDLY_AR_PASSTHROUGH = 'تعذر تحديد نوع المدرب. يرجى مراجعة الإدارة.';

export function friendlyError(error: unknown, ar: boolean): string {
  if (error instanceof Error) {
    const message = error.message || '';
    if (isFriendlyError(error)) return message;
    if (message === FRIENDLY_AR_PASSTHROUGH) return message;
    if (/[\u0600-\u06FF]/.test(message)) return message; // Arabic text is authored for users.
  }
  console.error('[friendlyError] raw error:', error);
  return ar
    ? 'تعذر إتمام العملية. حاول مجددًا، وإذا استمر الخطأ تواصل مع الإدارة.'
    : 'Unable to complete this action. Please try again, or contact administration if the problem continues.';
}

// For sites that intentionally throw friendly, screen-ready messages.
export { friendly };
