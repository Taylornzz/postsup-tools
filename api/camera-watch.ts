import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

/* Camera catalog watch — web-searches for current professional cinema cameras and returns the
 * ones NOT already in the app's catalog (a completeness diff, not news). Runs ~monthly client-side.
 * The Anthropic key lives only here (server env). Required env: ANTHROPIC_API_KEY.  Optional: ANTHROPIC_MODEL. */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

const SYSTEM =
  "You audit a film/TV post-production app's CAMERA CATALOG for completeness. You are given the list of cameras the " +
  "catalog ALREADY has. Use web search to find CURRENT professional digital cinema cameras (roughly 2023–2026) from " +
  "ARRI, Sony, RED, Canon, Blackmagic, Panavision, Kinefinity, Z CAM, Vision Research/Phantom and other cine makers, " +
  "and return ONLY the ones that are NOT already in the catalog.\n" +
  "RULES:\n" +
  "- Normalise for naming variants: if the catalog already lists a camera under a slightly different name (e.g. 'RED " +
  "V-RAPTOR [X] VV' == 'V-Raptor X'), do NOT report it as missing. When unsure whether it's already covered, omit it.\n" +
  "- Prioritise high-end cinema and large-format bodies a feature production would use; you may include notable pro-cine " +
  "and high-speed bodies. Do NOT report consumer mirrorless, phones, drones, or action cams unless they're a genuine " +
  "cinema tool.\n" +
  "- Every `source` MUST be a real manufacturer or reputable URL returned by your search. Never invent a link.\n" +
  "- For each missing camera give brand, exact model, a short `keySpecs` (sensor size, max resolution, log/gamut), the " +
  "release `year` if known, and the `source`.\n" +
  "- Return at most ~12 of the most relevant missing cameras. If the catalog looks complete, return an empty list with a " +
  "one-line summary saying so.\n" +
  "ALWAYS finish by calling the `camera_gaps` tool — never reply with plain text.";

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "one line: overall completeness / biggest gap" },
    flagged: {
      type: "array",
      description: "cameras that exist in the real world but are NOT in the catalog",
      items: {
        type: "object",
        properties: {
          brand: { type: "string" },
          model: { type: "string" },
          keySpecs: { type: "string", description: "sensor size mm, max resolution, log/gamut" },
          year: { type: "string" },
          source: { type: "string", description: "real manufacturer/reputable URL" },
        },
        required: ["brand", "model", "source"],
      },
    },
  },
  required: ["flagged"],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(503).json({ error: "not_configured", message: "AI isn't set up — add ANTHROPIC_API_KEY to the Vercel project environment, then redeploy." }); return; }

  try {
    const body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) || {};
    const cameras: string[] = Array.isArray(body.cameras) ? body.cameras.map(String).slice(0, 200) : [];
    if (!cameras.length) { res.status(400).json({ error: "no_input", message: "Send the current camera list." }); return; }

    const userText =
      `The catalog already contains these ${cameras.length} cameras:\n${cameras.join("\n")}\n\n` +
      `Search the web for current professional cinema cameras and return, via the camera_gaps tool, the ones that are NOT already in this list (normalising naming variants). Today is mid-2026.`;

    const client = new Anthropic({ apiKey });
    const params = {
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      tools: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { type: "web_search_20250305", name: "web_search", max_uses: 3 } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { name: "camera_gaps", description: "Return the cameras missing from the catalog + a one-line summary.", input_schema: SCHEMA as any },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: "user", content: userText }] as any[],
    };
    let msg = await client.messages.create(params);
    // Server-side web search can pause a long turn — continue it (bounded) instead of failing.
    for (let i = 0; i < 2 && msg.stop_reason === "pause_turn"; i++) {
      params.messages = [...params.messages, { role: "assistant", content: msg.content }];
      msg = await client.messages.create(params);
    }
    if (msg.stop_reason === "max_tokens") { res.status(502).json({ error: "truncated", message: "The check was cut short — try again." }); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUse = (msg.content as any[]).find((c) => c?.type === "tool_use" && c?.name === "camera_gaps");
    if (!toolUse) { res.status(502).json({ error: "no_result", message: "Couldn't run the catalog check — try again." }); return; }

    const input = toolUse.input as { summary?: string; flagged?: unknown[] };
    // Keep only entries with a real http(s) source so a bad link never reaches the UI.
    const flagged = Array.isArray(input.flagged)
      ? input.flagged.filter((it): it is { brand: string; model: string; keySpecs?: string; year?: string; source: string } => {
          const o = it as { model?: unknown; brand?: unknown; source?: unknown };
          return !!o && typeof o.model === "string" && typeof o.brand === "string" && typeof o.source === "string" && /^https?:\/\//i.test(o.source);
        }).slice(0, 12)
      : [];

    res.status(200).json({ summary: input.summary || "", flagged });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const code = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(code).json({ error: "ai_error", message: err.message || "Camera-watch request failed (web search may not be enabled on this API key)." });
  }
}
