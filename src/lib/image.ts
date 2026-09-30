// Receipt capture: phone photos arrive at 3–4 MB and screenshots as large PNGs,
// and base64 adds another third on top. The model reads a 1568px JPEG just as
// well, so downscale and re-encode before anything touches the network.

export const MAX_EDGE = 1568;
const JPEG_QUALITY = 0.85;

/** Fit (w, h) inside a max long edge, preserving aspect ratio. Never scales up. */
export function fitWithin(w: number, h: number, max: number = MAX_EDGE) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Downscale to a JPEG data URL. Falls back to the untouched file if the
 *  browser can't decode it (HEIC on older Safari, mainly). */
export async function imageToBase64(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } catch {
    return readAsDataURL(file);
  }
}
