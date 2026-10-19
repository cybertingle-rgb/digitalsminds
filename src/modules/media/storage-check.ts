import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db } from "@/lib/db";
import { freeBytes, uploadRoot } from "@/lib/storage/local";

/**
 * Proves that the upload folder survives redeploys before uploads are allowed.
 * A marker file records the build that created it; when a later build still
 * finds it, the folder is persistent.
 */

const KEY = "storage.status";
const MARKER = ".storage-check.json";

const stored = z.object({
  root: z.string(),
  firstBuildId: z.string(),
  persistentSince: z.string().nullable(),
  lastCheckedAt: z.string(),
});

export type StorageStatus = {
  root: string;
  writable: boolean;
  insideApp: boolean;
  persistent: boolean;
  /** True on development machines, where redeploys don't apply. */
  devMode: boolean;
  uploadsEnabled: boolean;
  freeBytes: number | null;
  lastCheckedAt: string | null;
  problem: string | null;
};

export async function currentBuildId(): Promise<string> {
  try {
    return (await readFile(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8")).trim();
  } catch {
    return "development";
  }
}

function isInsideApp(root: string) {
  const app = path.resolve(process.cwd());
  return root === app || root.startsWith(app + path.sep);
}

async function writable(root: string): Promise<boolean> {
  try {
    await mkdir(root, { recursive: true, mode: 0o750 });
    const probe = path.join(root, `.probe-${randomUUID()}`);
    await writeFile(probe, "ok");
    await rm(probe);
    return true;
  } catch {
    return false;
  }
}

/** Runs the check (creates the marker on first run) and stores the result. */
export async function runStorageCheck(): Promise<StorageStatus> {
  const root = uploadRoot();
  const build = await currentBuildId();
  const canWrite = await writable(root);
  let marker: { buildId: string; createdAt: string } | null = null;
  if (canWrite) {
    const markerPath = path.join(root, MARKER);
    try {
      marker = JSON.parse(await readFile(markerPath, "utf8"));
    } catch {
      marker = { buildId: build, createdAt: new Date().toISOString() };
      await writeFile(markerPath, JSON.stringify(marker));
    }
  }
  const previous = await readStored();
  const survivedDeploy = !!marker && marker.buildId !== build;
  const persistentSince = survivedDeploy ? (previous?.root === root && previous.persistentSince) || new Date().toISOString() : null;
  if (marker) {
    const value = { root, firstBuildId: marker.buildId, persistentSince, lastCheckedAt: new Date().toISOString() };
    await db().siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
  }
  return getStorageStatus();
}

async function readStored() {
  const row = await db().siteSetting.findUnique({ where: { key: KEY } });
  const parsed = stored.safeParse(row?.value);
  return parsed.success ? parsed.data : null;
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const root = uploadRoot();
  const insideApp = isInsideApp(root);
  const devMode = process.env.NODE_ENV !== "production";
  const canWrite = await writable(root);
  const s = await readStored();
  const persistent = !!s && s.root === root && !!s.persistentSince;
  const problem = !canWrite
    ? "The upload folder can't be written. Check UPLOAD_DIR or folder permissions."
    : insideApp
      ? "The upload folder is inside the app folder, which is replaced on every deploy. Set UPLOAD_DIR to a folder outside it."
      : null;
  return {
    root,
    writable: canWrite,
    insideApp,
    persistent,
    devMode,
    uploadsEnabled: !problem && (persistent || devMode),
    freeBytes: canWrite ? await freeBytes(root) : null,
    lastCheckedAt: s?.lastCheckedAt ?? null,
    problem,
  };
}
