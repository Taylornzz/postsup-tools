import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

/* News digest — runs a single News Watch: searches the web for the most relevant RECENT
 * reporting on a topic (scoped by region + keywords + cadence) and returns a tight digest
 * the in-app feed renders. Every item carries a REAL url found via search — no invented links.
 * The Anthropic key lives only here (server env). Required env: ANTHROPIC_API_KEY. */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

const SYSTEM =
  "You are a news researcher for a film & television post-production professional. You run one 'watch' — a topic the " +
  "user wants tracked — and produce a short digest of the most relevant RECENT reporting.\n" +
  "Use web search to find current items, then return the digest via the `news_digest` tool.\n" +
  "RULES:\n" +
  "- Every item's `url` MUST be a real link returned by your web search. Never invent, guess, or shorten a URL. If you " +
  "cannot find a real link for a headline, drop that headline.\n" +
  "- Prioritise RECENCY. For a daily watch favour the last ~3 days; for a weekly watch the last ~2 weeks. Put the most " +
  "important/newest item first. Skip anything older than ~2 months unless it's the only relevant material.\n" +
  "- Respect the region(s): prefer reporting about, or from, those places. If the watch is worldwide, cover the most " +
  "significant items globally.\n" +
  "- Stay on the topic and any sharpening keywords. Don't pad with loosely-related stories.\n" +
  "- Each item: a clear headline (`title`), the outlet (`source`), the real `url`, and a `date` (publication date as you " +
  "find it — ISO or 'D Mon YYYY'; use '' if genuinely unknown).\n" +
  "- The `tldr` is 2–3 plain-English sentences a busy post supervisor can read in five seconds: what's new and why it " +
  "matters. No preamble, no 'here is'.\n" +
  "- Return 3–8 items when the material exists. If almost nothing real turned up, return an honest one-line tldr saying so " +
  "and as many real items as you found (possibly zero).";

const DIGEST_SCHEMA = {
  type: "object",
  properties: {
    tldr: { type: "string", description: "2–3 plain-English sentences: what's new and why it matters." },
    items: {
      type: "array",
      description: "Most relevant recent items, newest/most-important first. Real URLs only.",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Headline." },
          source: { type: "string", description: "Outlet / publication name." },
          url: { type: "string", description: "Real link found via web search." },
          date: { type: "string", description: "Publication date (ISO or 'D Mon YYYY'); '' if unknown." },
        },
        required: ["title", "source", "url"],
      },
    },
    noResults: { type: "boolean", description: "True if no genuinely relevant recent reporting was found." },
  },
  required: ["tldr", "items"],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(503).json({ error: "not_configured", message: "AI isn't set up — add ANTHROPIC_API_KEY to the Vercel project environment, then redeploy." }); return; }

  try {
    const body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) || {};
    const topic: string = typeof body.topic === "string" ? body.topic.slice(0, 500) : "";
    const regions: string[] = Array.isArray(body.regions) ? body.regions.map(String).slice(0, 8) : [];
    const keywords: string[] = Array.isArray(body.keywords) ? body.keywords.map(String).slice(0, 12) : [];
    const cadence: string = body.cadence === "daily" ? "daily" : "weekly";
    if (!topic.trim()) { res.status(400).json({ error: "no_input", message: "A watch topic is required." }); return; }

    const today = new Date().toISOString().slice(0, 10);
    const where = regions.length ? regions.join(", ") : "worldwide";
    const userText =
      `Today is ${today}. Run this watch and return a ${cadence} digest via the news_digest tool.\n\n` +
      `Topic: ${topic}\n` +
      `Region focus: ${where}\n` +
      (keywords.length ? `Sharpen with: ${keywords.join(", ")}\n` : "") +
      `\nSearch the web for the most relevant recent reporting, then return the digest. Real URLs only.`;

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      tools: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { type: "web_search_20250305", name: "web_search", max_uses: 3 } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { name: "news_digest", description: "Return the digest: a short tldr plus real, recent items.", input_schema: DIGEST_SCHEMA as any },
      ],
      messages: [{ role: "user", content: userText }],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUse = (msg.content as any[]).find((c) => c?.type === "tool_use" && c?.name === "news_digest");
    if (!toolUse) { res.status(502).json({ error: "no_result", message: "Couldn't assemble a digest — try again or widen the topic." }); return; }

    // Defensive: keep only items with a real http(s) url so a malformed link never reaches the feed.
    const input = toolUse.input as { tldr?: string; items?: unknown[]; noResults?: boolean };
    const items = Array.isArray(input.items)
      ? input.items.filter((it): it is { title: string; source: string; url: string; date?: string } => {
          const o = it as { title?: unknown; url?: unknown };
          return !!o && typeof o.title === "string" && typeof o.url === "string" && /^https?:\/\//i.test(o.url);
        })
      : [];

    res.status(200).json({ tldr: input.tldr || "", items, noResults: !!input.noResults || items.length === 0 });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const code = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(code).json({ error: "ai_error", message: err.message || "News request failed (web search may not be enabled on this API key)." });
  }
}
