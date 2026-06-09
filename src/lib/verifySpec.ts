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
