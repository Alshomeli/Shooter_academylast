const MAX_EDGE = 1600;
const QUALITY = 0.80;
const MAX_INPUT_BYTES = 20_000_000;
const MAX_OUTPUT_BYTES = 5_000_000;

export interface CompressionResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } catch {
    throw new Error('Unable to read this photo. On iPhone, try selecting a JPG/PNG photo or exporting the photo as Most Compatible.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: File): Promise<CompressionResult> {
  if (!file.type.startsWith('image/') || !file.size || file.size > MAX_INPUT_BYTES) {
    throw new Error('Use a photo smaller than 20 MB.');
  }

  const originalSize = file.size;
  const image = await loadImage(file);
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!width || !height) throw new Error('Unable to read this photo.');

  let targetW = width;
  let targetH = height;
  if (Math.max(width, height) > MAX_EDGE) {
    const scale = MAX_EDGE / Math.max(width, height);
    targetW = Math.round(width * scale);
    targetH = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image compression is unavailable in this browser.');
  ctx.drawImage(image, 0, 0, targetW, targetH);

  // Prefer WebP when the browser can really encode it. Some Safari/iPhone
  // versions cannot, so fall back to JPEG instead of blocking registration.
  let blob = await canvasToBlob(canvas, 'image/webp', QUALITY);
  if (!blob?.size || blob.type !== 'image/webp') {
    blob = await canvasToBlob(canvas, 'image/jpeg', QUALITY);
  }
  if (!blob?.size) throw new Error('Unable to compress this image in this browser.');

  if (blob.size > MAX_OUTPUT_BYTES) {
    const smaller = await canvasToBlob(canvas, 'image/jpeg', 0.68);
    if (smaller?.size) blob = smaller;
  }
  if (blob.size > MAX_OUTPUT_BYTES) {
    throw new Error('Choose a smaller photo. The compressed file must be under 5 MB.');
  }

  return {
    blob,
    originalSize,
    compressedSize: blob.size,
    reductionPercent: Math.max(0, Math.round((1 - blob.size / originalSize) * 100)),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
