import type { Recipient } from "./deliverables";

/** Client for /api/verify-spec — web-search-verify a platform's current delivery spec and
 *  return the best-known values + sources. The result is a SUGGESTION the user confirms by
 *  hand (a field-level diff in the UI) — never auto-applied. */

export interface SpecVerifyResult {
  spec: Partial<Recipient>;
  sources?: { url?: string; quote?: string }[];
  confidence?: "low" | "medium";
  summary?: string;
}

/** The spec fields we verify + diff (shared by the per-recipient Verify and the batch drift check). */
export const SPEC_FIELDS: { key: keyof Recipient; label: string }[] = [
  { key: "region", label: "Region" }, { key: "dr", label: "Colour / range" }, { key: "peakNits", label: "Peak nits" },
  { key: "resolution", label: "Resolution" }, { key: "fps", label: "FPS" }, { key: "container", label: "Container" },
  { key: "audio", label: "Audio" }, { key: "loudness", label: "Loudness" }, { key: "truePeak", label: "True-peak" }, { key: "subtitles", label: "Subtitles" },
];

export interface SpecDiff { key: keyof Recipient; label: string; from: string; to: string; }

/** Field-level differences between a recipient's current spec and a verified spec — only
 *  fields the verifier actually returned (omitted/blank fields are not "changes"). */
export function recipientSpecDiffs(r: Recipient, spec: Partial<Recipient>): SpecDiff[] {
  return SPEC_FIELDS
    .filter((f) => spec[f.key] !== undefined && spec[f.key] !== "" && String(spec[f.key]) !== String(r[f.key] ?? ""))
    .map((f) => ({ key: f.key, label: f.label, from: String(r[f.key] ?? "—"), to: String(spec[f.key]) }));
}

export async function verifySpec(
  platform: string, current: Partial<Recipient>, specOptions: Record<string, (string | number)[]>,
): Promise<SpecVerifyResult> {
  let resp: Response;
  try {
    resp = await fetch("/api/verify-spec", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ platform, current, specOptions }),
    });
  } catch {
    throw new Error("Couldn’t reach the verify service — it only runs on the deployed site, not local dev.");
  }
  let data: (SpecVerifyResult & { message?: string }) | null = null;
  try { data = await resp.json(); } catch { /* non-JSON */ }
  if (!resp.ok) {
    if (resp.status === 404) throw new Error("Verify endpoint not found — it runs on the deployed site, not local vite dev.");
    throw new Error(data?.message || `Verify failed (${resp.status}).`);
  }
  return (data || { spec: {} }) as SpecVerifyResult;
}
