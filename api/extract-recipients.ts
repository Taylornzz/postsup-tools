import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

/* Deliverables AI ingest — reads an uploaded delivery spec / contract / platform tech-doc
 * and returns the delivery recipients it finds, each field constrained to the app's own
 * option sets, with a verbatim source quote per field. The Anthropic key lives only here
 * (server-side env), never in the client bundle.
 *
 * Required env: ANTHROPIC_API_KEY.  Optional: ANTHROPIC_MODEL (defaults below). */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

const SYSTEM =
  "You are a senior post-production delivery manager. You read delivery specifications, platform " +
  "technical specs and delivery contracts, and extract the exact technical delivery requirements for " +
  "each recipient/target. You never invent values — you only use the allowed option values provided, " +
  "and you omit any field the document does not state rather than guessing. For every field you set, " +
  "you cite the exact short verbatim quote from the document that justifies it.";

const INSTRUCTION =
  "Read the attached delivery spec(s). Identify each distinct delivery recipient/target (a streaming " +
  "platform, broadcaster, festival, DCP house, or territory). For each, return its technical " +
  "requirements via the `deliverables` tool, choosing ONLY from the allowed values for each enumerated " +
  "field. Omit any field the document doesn't state. For each field you DO set, add a short verbatim " +
  "source quote to `sources`, keyed by field name. If the document describes a single delivery, return " +
  "exactly one recipient.";

type Opts = Record<string, (string | number)[]>;

function schema(options: Opts): Record<string, unknown> {
  const en = (k: string) => (Array.isArray(options[k]) && options[k].length ? { enum: options[k] } : {});
  return {
    type: "object",
    properties: {
      recipients: {
        type: "array",
        description: "Every distinct delivery recipient/target found in the documents.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Platform / broadcaster / festival / territory name." },
            region: { type: "string", ...en("region") },
            dr: { type: "string", description: "Dynamic range / colour pipeline.", ...en("dr") },
            peakNits: { type: "number", description: "HDR peak luminance in nits (only when an HDR tier)." },
            resolution: { type: "string", ...en("resolution") },
            fps: { type: "number", description: "Delivery frame rate.", ...en("fps") },
            container: { type: "string", ...en("container") },
            audio: { type: "string", ...en("audio") },
            loudness: { type: "string", ...en("loudness") },
            truePeak: { type: "string", ...en("truePeak") },
            subtitles: { type: "string", ...en("subtitles") },
            textless: { type: "boolean", description: "Whether a textless / clean version is required." },
            notes: { type: "string", description: "Other requirements not captured by the fields above." },
            sources: { type: "object", description: "Map of field name -> exact verbatim source quote.", additionalProperties: { type: "string" } },
          },
          required: ["name"],
        },
      },
    },
    required: ["recipients"],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(503).json({ error: "not_configured", message: "AI ingest isn't set up yet — add ANTHROPIC_API_KEY to the Vercel project environment, then redeploy." }); return; }

  try {
    const body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) || {};
    const documents: { name: string; mediaType: string; dataBase64: string }[] = Array.isArray(body.documents) ? body.documents.slice(0, 10) : [];
    const text: string | undefined = typeof body.text === "string" ? body.text : undefined;
    const options: Opts = body.options && typeof body.options === "object" ? body.options : {};
    if (documents.length === 0 && !text) { res.status(400).json({ error: "no_input", message: "Attach a delivery spec (PDF, image, or text)." }); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [];
    for (const d of documents) {
      if (d.mediaType === "application/pdf") {
        content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: d.dataBase64 } });
      } else if (/^image\/(jpeg|png|gif|webp)$/.test(d.mediaType)) {
        content.push({ type: "image", source: { type: "base64", media_type: d.mediaType, data: d.dataBase64 } });
      } else {
        const decoded = Buffer.from(d.dataBase64 || "", "base64").toString("utf8").slice(0, 200_000);
        content.push({ type: "text", text: `--- ${d.name} ---\n${decoded}` });
      }
    }
    if (text) content.push({ type: "text", text: text.slice(0, 200_000) });
    content.push({ type: "text", text: INSTRUCTION });

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ name: "deliverables", description: "Return the delivery recipients/targets found in the documents.", input_schema: schema(options) as any }],
      tool_choice: { type: "tool", name: "deliverables" },
      messages: [{ role: "user", content }],
    });

    // A response cut off at max_tokens carries an empty or partial tool input — returning it
    // as a 200 would present a partial recipient list as the complete one.
    if (msg.stop_reason === "max_tokens") { res.status(502).json({ error: "truncated", message: "The extraction was cut short — try fewer or smaller documents." }); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUse = (msg.content as any[]).find((c) => c?.type === "tool_use");
    if (!toolUse) { res.status(502).json({ error: "no_extraction", message: "The model didn't return structured recipients. Try a clearer spec." }); return; }
    res.status(200).json(toolUse.input);
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const code = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(code).json({ error: "ai_error", message: err.message || "AI request failed." });
  }
}
