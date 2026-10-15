import sharp from "sharp";
import { IMAGE_LONG_SIDE, IMAGE_SMALL_SIDE, MAX_UPLOAD_BYTES } from "./config";
import { db } from "./db";

export class ImageError extends Error {}

export const IMAGE_ERROR_TEXT = "Pakai JPG, PNG, atau WebP, maksimal 10 MB";

export interface ProcessedImage {
  data: Buffer;
  small: Buffer;
  width: number;
  height: number;
}

/** Validasi dari ISI file (bukan ekstensi), kecilkan ke sisi terpanjang 1800 px, JPEG kualitas 85%. */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length > MAX_UPLOAD_BYTES) throw new ImageError(IMAGE_ERROR_TEXT);
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new ImageError(IMAGE_ERROR_TEXT);
  }
  if (!format || !["jpeg", "png", "webp"].includes(format)) throw new ImageError(IMAGE_ERROR_TEXT);

  const base = sharp(input).rotate().flatten({ background: "#ffffff" });
  const data = await base
    .clone()
    .resize({ width: IMAGE_LONG_SIDE, height: IMAGE_LONG_SIDE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  const small = await base
    .clone()
    .resize({ width: IMAGE_SMALL_SIDE, height: IMAGE_SMALL_SIDE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  const meta = await sharp(data).metadata();
  return { data, small, width: meta.width || 0, height: meta.height || 0 };
}

export async function saveSceneImage(sceneId: number, img: ProcessedImage) {
  const pool = await db();
  await pool.query(
    `INSERT INTO scene_images (scene_id, mime, width, height, bytes, data, data_sm)
     VALUES (?, 'image/jpeg', ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE mime=VALUES(mime), width=VALUES(width), height=VALUES(height),
       bytes=VALUES(bytes), data=VALUES(data), data_sm=VALUES(data_sm), updated_at=CURRENT_TIMESTAMP`,
    [sceneId, img.width, img.height, img.data.length, img.data, img.small]
  );
}
