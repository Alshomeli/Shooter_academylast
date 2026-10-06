import { supabase } from '@/lib/supabase';

const BUCKET = 'player-documents';
const MAX_PHOTO_BYTES = 2_000_000; // 2 MB target after compression
const MAX_IMAGE_INPUT_BYTES = 20_000_000; // bounded source image before compression
const MAX_DOC_BYTES = 5_000_000; // 5 MB for PDF documents
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export interface UploadedFile {
  id: string;
  playerId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileCategory: 'photo' | 'document';
  fileSize: number;
  publicUrl: string;
  uploadedAt: string;
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

/** Compress an image file to fit within MAX_PHOTO_BYTES, preserving aspect ratio. */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 800;
  let { width, height } = bitmap;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new UploadError('تعذر معالجة الصورة');
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Try progressively lower quality until under target
  let quality = 0.85;
  let blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  while (blob && blob.size > MAX_PHOTO_BYTES && quality > 0.3) {
    quality -= 0.15;
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }
  if (!blob) throw new UploadError('تعذر ضغط الصورة');
  return blob;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function validateFile(file: File): void {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new UploadError('صيغة الملف غير مدعومة. المسموح: JPG, PNG, WebP, PDF');
  }
  const isImage = file.type.startsWith('image/') && file.type !== 'application/pdf';
  const limit = isImage ? MAX_IMAGE_INPUT_BYTES : MAX_DOC_BYTES;
  if (file.size > limit) {
    throw new UploadError(`حجم الملف كبير جداً. الحد الأقصى ${Math.round(limit / 1_000_000)} ميجابايت`);
  }
}

export async function uploadPlayerFile(
  playerId: string,
  file: File,
  category: 'photo' | 'document' = 'document',
): Promise<UploadedFile> {
  validateFile(file);

  const isImage = file.type.startsWith('image/') && file.type !== 'application/pdf';
  let uploadBlob: Blob = file;
  let finalType = file.type;
  let finalName = file.name;

  if (isImage && file.type !== 'application/pdf') {
    uploadBlob = await compressImage(file);
    if (uploadBlob.size > MAX_PHOTO_BYTES) {
      throw new UploadError('تعذر ضغط الصورة إلى الحجم المطلوب. اختر صورة أصغر.');
    }
    finalType = 'image/jpeg';
    finalName = file.name.replace(/\.(png|webp|jpg|jpeg)$/i, '.jpg');
  }

  const ext = finalName.split('.').pop() || 'bin';
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `${playerId}/${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, uploadBlob, { contentType: finalType, upsert: false });

  if (upErr) {
    console.error('[upload]', upErr.message);
    throw new UploadError('فشل رفع الملف. يرجى المحاولة مرة أخرى.');
  }

  const signedUrl = await signedUrlFor(filePath);

  const { data: row, error: dbErr } = await supabase
    .from('player_documents')
    .insert({
      player_id: playerId,
      file_name: finalName,
      file_path: filePath,
      file_type: finalType,
      file_category: category,
      file_size: uploadBlob.size,
    })
    .select('id, uploaded_at')
    .single();

  if (dbErr || !row) {
    // Best-effort cleanup of orphaned storage object
    await supabase.storage.from(BUCKET).remove([filePath]);
    throw new UploadError('فشل حفظ بيانات الملف');
  }

  return {
    id: row.id,
    playerId,
    fileName: finalName,
    filePath,
    fileType: finalType,
    fileCategory: category,
    fileSize: uploadBlob.size,
    publicUrl: signedUrl,
    uploadedAt: row.uploaded_at,
  };
}

/* The bucket is private, so links are short-lived signed URLs rather than public ones. */
const SIGNED_URL_TTL = 60 * 60;

async function signedUrlFor(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error) {
    console.error('[signedUrl]', error.message);
    throw new UploadError('فشل إنشاء رابط الملف');
  }
  return data?.signedUrl ?? '';
}

async function signedUrlMap(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
  for (const entry of data || []) {
    if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

export async function fetchPlayerFiles(playerId: string): Promise<UploadedFile[]> {
  const { data, error } = await supabase
    .from('player_documents')
    .select('id, player_id, file_name, file_path, file_type, file_category, file_size, uploaded_at')
    .eq('player_id', playerId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('[fetchPlayerFiles]', error.message);
    return [];
  }

  const rows = data || [];
  const urls = await signedUrlMap(rows.map((r) => r.file_path));
  return rows.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    fileName: r.file_name,
    filePath: r.file_path,
    fileType: r.file_type,
    fileCategory: r.file_category as 'photo' | 'document',
    fileSize: r.file_size,
    publicUrl: urls.get(r.file_path) ?? '',
    uploadedAt: r.uploaded_at,
  }));
}

export async function deletePlayerFile(file: UploadedFile): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new UploadError('يجب تسجيل الدخول لحذف الملفات');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-player-file`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ documentId: file.id }),
  });
  if (!res.ok) {
    let msg = `فشل الحذف (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = `فشل الحذف: ${body.error}`;
    } catch {
      // ignore JSON parse error
    }
    throw new UploadError(msg);
  }
}

export async function fetchAllPlayerFiles(): Promise<UploadedFile[]> {
  const { data, error } = await supabase
    .from('player_documents')
    .select('id, player_id, file_name, file_path, file_type, file_category, file_size, uploaded_at')
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('[fetchAllPlayerFiles]', error.message);
    return [];
  }

  const rows = data || [];
  const urls = await signedUrlMap(rows.map((r) => r.file_path));
  return rows.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    fileName: r.file_name,
    filePath: r.file_path,
    fileType: r.file_type,
    fileCategory: r.file_category as 'photo' | 'document',
    fileSize: r.file_size,
    publicUrl: urls.get(r.file_path) ?? '',
    uploadedAt: r.uploaded_at,
  }));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}
