/**
 * Google Drive video links. Admins paste whatever Drive gives them; we keep
 * the file ID and build the official embed URL ourselves, so arbitrary URLs
 * can never end up inside an iframe.
 */

const ID = "[A-Za-z0-9_-]{20,100}";
const PATTERNS = [
  new RegExp(`^https://drive\\.google\\.com/file/d/(${ID})(?:/[a-z]*)?/?(?:[?#].*)?$`),
  new RegExp(`^https://drive\\.google\\.com/(?:open|uc)\\?(?:.*&)?id=(${ID})(?:&.*)?$`),
  new RegExp(`^https://docs\\.google\\.com/file/d/(${ID})(?:/[a-z]*)?/?(?:[?#].*)?$`),
];

export function driveFileId(url: string): string | null {
  const trimmed = url.trim();
  for (const re of PATTERNS) {
    const m = re.exec(trimmed);
    if (m) return m[1]!;
  }
  return null;
}

export function driveEmbedUrl(id: string) {
  return `https://drive.google.com/file/d/${id}/preview`;
}

export function driveViewUrl(id: string) {
  return `https://drive.google.com/file/d/${id}/view`;
}
