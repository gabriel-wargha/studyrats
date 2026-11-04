export const MAX_PHOTO_EDGE = 1600;
export const JPEG_QUALITY = 0.8;

/**
 * Size that fits inside a max x max box, keeping the aspect ratio.
 * Never scales up. Sizes are whole pixels of at least 1.
 */
export function fitWithin(
  width: number,
  height: number,
  max: number = MAX_PHOTO_EDGE,
): { width: number; height: number } {
  if (![width, height, max].every((n) => Number.isFinite(n) && n > 0)) {
    throw new RangeError("Image size must be positive");
  }
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Browser only. Decodes an image file, shrinks it to at most 1600 px on the
 * long edge and re-encodes it as JPEG. Drawing to a canvas drops EXIF data,
 * including location.
 */
export async function resizeToJpeg(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    // JPEG has no alpha, so paint white under transparent PNGs.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))),
        "image/jpeg",
        JPEG_QUALITY,
      );
    });
  } finally {
    bitmap.close();
  }
}
