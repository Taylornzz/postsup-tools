import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

/* Verify a platform's current delivery spec via web search and return a field-level diff the
 * user confirms by hand — never auto-applied. The Anthropic key lives only here (server env).
 * Required env: ANTHROPIC_API_KEY.  Optional: ANTHROPIC_MODEL. */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

const SYSTEM =
  "You verify a video delivery spec for a post-production tool. Given a platform/recipient name and the user's CURRENT " +
  "spec values, use web search to find the platform's CURRENT published delivery / QC specification, then return the " +
  "best-known current spec via the `verified_spec` tool.\n" +
  "RULES: only set a field if you found a credible PUBLIC source for it — include the source URL + a short verbatim quote. " +
  "If a field is behind a partner portal or you cannot verify it, OMIT it (never guess). Choose ONLY from the allowed enum " +
  "values for each field. Confidence is at most 'medium' for anything web-derived — never 'high'. The platform's own partner " +
  "portal and per-title specs are the authoritative source; make clear the user must confirm there.\n" +
  "ALWAYS finish by calling the `verified_spec` tool with your findings — never reply with a plain-text answer.";

type Opts = Record<string, (string | number)[]>;

function schema(opts: Opts): Record<string, unknown> {
  const en = (k: string) => (Array.isArray(opts[k]) && opts[k].length ? { enum: opts[k] } : {});
  return {
    type: "object",
    properties: {
      spec: {
        type: "object",
        description: "The platform's current best-known delivery spec — ONLY fields you verified against a public source.",
        properties: {
          region: { type: "string", ...en("region") },
          dr: { type: "string", description: "Colour pipeline / dynamic range.", ...en("dr") },
          peakNits: { type: "number" },
          resolution: { type: "string", ...en("resolution") },
          fps: { type: "number", ...en("fps") },
          container: { type: "string", ...en("container") },
          audio: { type: "string", ...en("audio") },
          loudness: { type: "string", ...en("loudness") },
          truePeak: { type: "string", ...en("truePeak") },
          subtitles: { type: "string", ...en("subtitles") },
        },
      },
      sources: { type: "array", description: "Public sources used.", items: { type: "object", properties: { url: { type: "string" }, quote: { type: "string" } } } },
      confidence: { type: "string", enum: ["low", "medium"] },
      summary: { type: "string", description: "One line: what (if anything) differs from the user's current values, or 'portal-walled — confirm'." },
    },
    required: ["spec"],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(503).json({ error: "not_configured", message: "AI isn't set up yet — add ANTHROPIC_API_KEY to the Vercel project environment, then redeploy." }); return; }

  try {
    const body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) || {};
    const platform: string = typeof body.platform === "string" ? body.platform : "";
    const current = body.current && typeof body.current === "object" ? body.current : {};
    const specOptions: Opts = body.specOptions && typeof body.specOptions === "object" ? body.specOptions : {};
    if (!platform.trim()) { res.status(400).json({ error: "no_input", message: "Recipient / platform name required to verify." }); return; }

    const userText =
      `Platform / recipient: ${platform}\n\nThe user's CURRENT spec values:\n${JSON.stringify(current, null, 2)}\n\n` +
      `Search the web for ${platform}'s current delivery / QC specification and return the verified current spec via the verified_spec tool, with sources and a one-line summary of any differences.`;

    const client = new Anthropic({ apiKey });
    const params = {
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      tools: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { type: "web_search_20250305", name: "web_search", max_uses: 3 } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { name: "verified_spec", description: "Return the verified current spec + sources + confidence.", input_schema: schema(specOptions) as any },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: "user", content: userText }] as any[],
    };
    let msg = await client.messages.create(params);
    // Server-side web search can pause a long turn (stop_reason "pause_turn") — continue it
    // (bounded) by sending the paused content back, instead of failing with "no result".
    for (let i = 0; i < 2 && msg.stop_reason === "pause_turn"; i++) {
      params.messages = [...params.messages, { role: "assistant", content: msg.content }];
      msg = await client.messages.create(params);
    }
    if (msg.stop_reason === "max_tokens") { res.status(502).json({ error: "truncated", message: "The verify response was cut short — try again." }); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUse = (msg.content as any[]).find((c) => c?.type === "tool_use" && c?.name === "verified_spec");
    // A truncated/empty tool call can arrive without `spec` — returning it as a 200 would
    // crash the client, which renders `spec`'s fields.
    if (!toolUse || !toolUse.input || typeof toolUse.input.spec !== "object" || toolUse.input.spec === null) {
      res.status(502).json({ error: "no_result", message: "Couldn't pull a verifiable spec — confirm in the platform's partner portal." });
      return;
    }
    res.status(200).json(toolUse.input);
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const code = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(code).json({ error: "ai_error", message: err.message || "Verify request failed (web search may not be enabled on this API key)." });
  }
}
