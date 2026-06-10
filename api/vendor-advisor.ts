import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { VENDORS, VENDOR_REGION_LABEL, VENDOR_SCENARIOS, VENDORS_VERIFIED } from "../src/lib/vendors.js";

/* Vendor advisor — answers "who do I use for X?" questions, grounded EXCLUSIVELY in the
 * app's verified vendor directory (so it can never recommend a company that's gone bust).
 * The Anthropic key lives only here (server env). Required env: ANTHROPIC_API_KEY. */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

// Compact one-line-per-vendor directory for the prompt (~30KB, cached via prompt caching).
const DIRECTORY = VENDORS.map((v) =>
  `${v.name} | ${VENDOR_REGION_LABEL[v.region]}${v.city ? ` (${v.city})` : ""} | ${v.types.join(", ")} | ${v.blurb} | ${v.url}`
).join("\n");

const KNOWLEDGE = VENDOR_SCENARIOS.map((s) => `Q: ${s.q}\nA: ${s.a}`).join("\n\n");

const SYSTEM = [
  `You are the vendor advisor inside Kaos Theory, a post-production planning app used by film/TV post supervisors. You answer "who do I use for X?" questions — recommending real vendors for post-production work (labs, colour, VFX, audio, dailies, DCP/QC, captions, rentals, software).`,
  ``,
  `HARD RULES:`,
  `- Recommend ONLY vendors from the VERIFIED DIRECTORY below (every entry web-verified as operating, ${VENDORS_VERIFIED}; defunct companies like Technicolor/MPC, Milk VFX, Jellyfish, Pixomondo and Éclair were removed). Never invent or recall vendors from memory — if the directory has no fit, say so and recommend the nearest region's option or where productions typically ship the work.`,
  `- Name 2–4 specific vendors per recommendation (with city), ordered by fit. Explain the choice in one short clause each.`,
  `- Be practical about geography: a small-gauge lab can't develop a feature's 35mm; if a region has no production-scale option, say where the work realistically goes (this knowledge is in the curated answers below).`,
  `- Keep answers tight — a post supervisor on the clock. Short paragraphs or a compact list. No preamble.`,
  `- End risky/spec-dependent answers with a one-line reminder to confirm current status/services directly with the vendor.`,
  ``,
  `CURATED ANSWERS (trusted ground truth for these exact questions):`,
  KNOWLEDGE,
  ``,
  `VERIFIED DIRECTORY (name | region (city) | services | note | url):`,
  DIRECTORY,
].join("\n");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(503).json({ error: "not_configured", message: "AI isn't set up — add ANTHROPIC_API_KEY to the Vercel project environment." }); return; }

  try {
    const body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) || {};
    const question: string = typeof body.question === "string" ? body.question.slice(0, 2000) : "";
    const history: { role: "user" | "assistant"; text: string }[] = Array.isArray(body.history) ? body.history.slice(-8) : [];
    if (!question.trim()) { res.status(400).json({ error: "no_input", message: "Ask a question." }); return; }

    const messages = [
      ...history
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
        .map((m) => ({ role: m.role, content: m.text.slice(0, 2000) })),
      { role: "user" as const, content: question },
    ];

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      // cache the big stable system block — repeat questions hit the prompt cache
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
    });

    const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    if (!text) { res.status(502).json({ error: "no_answer", message: "No answer came back — try rephrasing." }); return; }
    res.status(200).json({ answer: text });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const code = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(code).json({ error: "ai_error", message: err.message || "AI request failed." });
  }
}
