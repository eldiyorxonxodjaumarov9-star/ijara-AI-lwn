/** Chiqish hajmi (~1.4 MB) — localStorage va tez yuklash uchun */
const DEFAULT_MAX_BYTES = 1_400_000;

/** Manba fayl — katta telefon suratlari ham qabul qilinadi */
export const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;

function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasm o'qib bo'lmadi"));
    };
    img.src = url;
  });
}

function renderJpeg(
  img: HTMLImageElement,
  maxWidth: number,
  quality: number
): string {
  const scale = Math.min(1, maxWidth / img.width);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas yaratib bo'lmadi");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export type CompressImageOptions = {
  /** Maksimal kenglik (px) — boshlang'ich */
  maxWidth?: number;
  /** Siqilgan fayl hajmi limiti (bayt) */
  maxBytes?: number;
  /** Eng past JPEG sifati */
  minQuality?: number;
};

/**
 * Rasmni tiniqligini saqlab JPEG ga siqadi.
 * Katta fayllar avtomatik kichraytiriladi — rad etilmaydi.
 */
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {}
): Promise<string> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const minQuality = options.minQuality ?? 0.55;
  const startWidth = options.maxWidth ?? 1920;

  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("Rasm 20 MB dan kichik bo'lishi kerak");
  }

  const img = await loadImageFromFile(file);

  const widthSteps = [
    startWidth,
    Math.round(startWidth * 0.85),
    Math.round(startWidth * 0.7),
    1280,
    1024,
  ].filter((w, i, arr) => w >= 640 && arr.indexOf(w) === i);

  const qualities = [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55].filter(
    (q) => q >= minQuality
  );

  let bestUnderLimit = "";
  let bestUnderQuality = 0;
  let smallest = "";
  let smallestSize = Infinity;

  for (const maxWidth of widthSteps) {
    for (const quality of qualities) {
      const dataUrl = renderJpeg(img, maxWidth, quality);
      const size = dataUrlByteSize(dataUrl);

      if (size < smallestSize) {
        smallestSize = size;
        smallest = dataUrl;
      }

      if (size <= maxBytes && quality > bestUnderQuality) {
        bestUnderLimit = dataUrl;
        bestUnderQuality = quality;
      }

      if (size <= maxBytes) break;
    }
    if (bestUnderLimit) break;
  }

  if (bestUnderLimit) return bestUnderLimit;
  if (smallest) return smallest;

  throw new Error("Rasm siqib bo'lmadi");
}
