export interface PendingUpload { path: string; uploaded: boolean; }

const extensions: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf',
};

export function registrationFilePath(applicationId: string, childId: string, mime: string): string {
  const extension = extensions[mime];
  if (!extension) throw new Error('Use JPG, PNG, WebP or PDF.');
  return `applications/${applicationId}/${childId}/${crypto.randomUUID()}.${extension}`;
}

/** Retain the same storage object if its metadata RPC needs a retry. */
export async function completeRegistrationUpload(
  job: PendingUpload,
  upload: (path: string) => Promise<void>,
  register: (path: string) => Promise<void>,
): Promise<void> {
  if (!job.uploaded) {
    await upload(job.path);
    job.uploaded = true;
  }
  await register(job.path);
}
