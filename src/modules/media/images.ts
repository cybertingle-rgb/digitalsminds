import "server-only";
import sharp from "sharp";

const MAX_EDGE = 2560;

/**
 * Re-encodes an uploaded image: applies the camera orientation, limits the
 * size, and drops all metadata (EXIF, GPS location, camera details). Anything
 * that isn't a valid image fails here.
 */
export async function processImage(input: Buffer, mime: "image/jpeg" | "image/png" | "image/webp") {
  const pipeline = sharp(input, { limitInputPixels: 50_000_000, failOn: "error" })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });
  const encoded =
    mime === "image/jpeg"
      ? pipeline.jpeg({ quality: 85, mozjpeg: true })
      : mime === "image/png"
        ? pipeline.png({ compressionLevel: 9 })
        : pipeline.webp({ quality: 85 });
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
