// Camera catalog watch — a ~monthly background web check that flags current cinema cameras
// not yet in the catalog (the durable fix for missing the ALEXA 265). Mirrors the spec-drift
// throttle. Suggestions only: the user reviews and asks for the ones they want added.

import { SOURCE_FORMATS } from "./formats";

export interface FlaggedCamera { brand: string; model: string; keySpecs?: string; year?: string; source: string; }
export interface CameraWatchState { flagged: FlaggedCamera[]; summary: string; checkedAt: string; dismissed: string[]; }

/** Distinct camera names currently in the catalog (drops the "(rotated)" duplicate variants). */
export function currentCameraNames(): string[] {
  const seen = new Set<string>();
  for (const s of SOURCE_FORMATS) {
    const name = s.camera.replace(/\s*\(rotated\)\s*$/i, "").trim();
    if (name) seen.add(name);
  }
  return [...seen].sort();
}

const STATE_KEY = "kaos.cameraWatch.v1";
const AT_KEY = "kaos.cameraWatch.at";          // last successful run
const ATTEMPT_KEY = "kaos.cameraWatch.attemptAt"; // last attempt (success or fail)
export const CAMERA_WATCH_INTERVAL_MS = 30 * 86400000; // ~1 month between successful runs
export const CAMERA_WATCH_RETRY_MS = 6 * 3600 * 1000;  // don't re-attempt within 6h of any attempt

const num = (k: string) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const stamp = (k: string, n: number) => { try { localStorage.setItem(k, String(n)); } catch { /* ignore */ } };

export const markCameraWatchAt = (at: number) => stamp(AT_KEY, at);
export const markCameraWatchAttempt = (at: number) => stamp(ATTEMPT_KEY, at);
export function cameraWatchDue(now: number): boolean {
  return now - num(AT_KEY) >= CAMERA_WATCH_INTERVAL_MS && now - num(ATTEMPT_KEY) >= CAMERA_WATCH_RETRY_MS;
}

export function loadCameraWatch(): CameraWatchState | null {
  try { const raw = localStorage.getItem(STATE_KEY); return raw ? (JSON.parse(raw) as CameraWatchState) : null; } catch { return null; }
}
export function saveCameraWatch(s: CameraWatchState | null) {
  try { if (s) localStorage.setItem(STATE_KEY, JSON.stringify(s)); else localStorage.removeItem(STATE_KEY); } catch { /* ignore */ }
}
const flagKey = (f: FlaggedCamera) => `${f.brand} ${f.model}`.toLowerCase().trim();
export function dismissFlagged(state: CameraWatchState | null, f: FlaggedCamera): CameraWatchState | null {
  if (!state) return state;
  return { ...state, dismissed: [...new Set([...(state.dismissed || []), flagKey(f)])] };
}
/** Flagged cameras the user hasn't dismissed. */
export function activeFlags(state: CameraWatchState | null): FlaggedCamera[] {
  if (!state) return [];
  const dis = new Set(state.dismissed || []);
  return (state.flagged || []).filter((f) => !dis.has(flagKey(f)));
}

/** Run the web check. Resolves with the flagged list; throws on offline / not-deployed. */
export async function fetchCameraWatch(cameras: string[]): Promise<{ summary: string; flagged: FlaggedCamera[] }> {
  let resp: Response;
  try {
    resp = await fetch("/api/camera-watch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cameras }),
    });
  } catch {
    throw new Error("Couldn't reach the catalog-watch service — it only runs on the deployed site.");
  }
  let data: { summary?: string; flagged?: FlaggedCamera[]; message?: string } | null = null;
  try { data = await resp.json(); } catch { /* non-JSON */ }
  if (!resp.ok) throw new Error(data?.message || `Catalog watch failed (${resp.status}).`);
  return { summary: data?.summary || "", flagged: Array.isArray(data?.flagged) ? data!.flagged! : [] };
}
