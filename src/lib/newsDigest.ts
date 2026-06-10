/** Client for /api/news-digest — runs one News Watch and returns a real, web-searched
 *  digest. Runs only on the deployed site (server-side key). */

import type { Watch, DigestItem } from "./watches";

export interface NewsDigestResult {
  tldr: string;
  items: DigestItem[];
  noResults: boolean;
}

export async function fetchNewsDigest(w: Watch): Promise<NewsDigestResult> {
  let resp: Response;
  try {
    resp = await fetch("/api/news-digest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: w.topic, regions: w.regions, keywords: w.keywords, cadence: w.cadence }),
    });
  } catch {
    throw new Error("Couldn’t reach the news service — it only runs on the deployed site, not local dev.");
  }
  let data: { tldr?: string; items?: DigestItem[]; noResults?: boolean; message?: string } | null = null;
  try { data = await resp.json(); } catch { /* non-JSON */ }
  if (!resp.ok) {
    if (resp.status === 404) throw new Error("News endpoint not found — it runs on the deployed site, not local vite dev.");
    throw new Error(data?.message || `News fetch failed (${resp.status}).`);
  }
  return {
    tldr: data?.tldr || "",
    items: Array.isArray(data?.items) ? data!.items! : [],
    noResults: !!data?.noResults,
  };
}
