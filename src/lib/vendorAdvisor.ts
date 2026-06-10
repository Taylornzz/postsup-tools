/** Client for /api/vendor-advisor — "who do I use for X?" answers grounded in the
 *  verified vendor directory. Runs on the deployed site (server-side key). */

export interface AdvisorMessage { role: "user" | "assistant"; text: string; }

export async function askVendorAdvisor(question: string, history: AdvisorMessage[]): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch("/api/vendor-advisor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, history }),
    });
  } catch {
    throw new Error("Couldn’t reach the AI service — it only runs on the deployed site, not local dev.");
  }
  let data: { answer?: string; message?: string } | null = null;
  try { data = await resp.json(); } catch { /* non-JSON */ }
  if (!resp.ok) {
    if (resp.status === 404) throw new Error("AI endpoint not found — it runs on the deployed site, not local vite dev.");
    throw new Error(data?.message || `Advisor failed (${resp.status}).`);
  }
  if (!data?.answer) throw new Error("No answer came back — try rephrasing.");
  return data.answer;
}
