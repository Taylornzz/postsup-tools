import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

/* Deliverables itemiser — turns a natural-language brief (+ uploaded documents) into the
 * post supervisor's master deliverables punch-list: every artifact, grouped by category,
 * flagged in/out of post's scope, with an owner and a note. The Anthropic key lives only
 * here (server env), never in the client bundle.
 *
 * Required env: ANTHROPIC_API_KEY.  Optional: ANTHROPIC_MODEL. */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

const SYSTEM =
  "You are a senior post-production supervisor building the master deliverables list (the 'punch list') " +
  "for a film/TV project. You turn a brief — what the production/distributor said they need — into a " +
  "complete, itemised list of every deliverable artifact. You include the things people forget: M&E, " +
  "stems (D/M/E), printmaster, fold-downs, textless/clean versions, forced narratives, QC reports, MHL/ALE. " +
  "Be especially thorough on AUDIO — it is the most-forgotten and most-rejected. You mark items that are " +
  "NOT post-production's responsibility (publicity stills, cast bios, EPK, key art, unit photography) as " +
  "out of scope and assign their likely owner. You never invent specifics that contradict the brief; when " +
  "the brief is vague you still list the standard items a delivery like this normally requires, noting they " +
  "must be confirmed.";

const INSTRUCTION =
  "From the brief and any attached documents, build the itemised deliverables list via the `deliverables_list` " +
  "tool. For each item give: a clear `label` (e.g. 'Feature — textless/clean', 'Viewing copy — with TCIP burn-in', " +
  "'M&E (5.1)', 'Stems (D/M/E)', 'Closed captions (EN SDH)', 'Publicity stills'); its `category`; whether it is in " +
  "post-production's scope (`inScope` false for publicity/marketing/EPK/stills/bios); the likely `owner`; and a short " +
  "`notes` value — a verbatim source quote if the brief stated it, or 'Standard — confirm' if you added it from best " +
  "practice. Cover picture, audio, subtitles/captions, metadata/paperwork, and any marketing items mentioned. Return a " +
  "flat list (the app groups by category).";

const CATEGORY = ["picture", "audio", "subtitles", "metadata", "marketing", "other"];
const OWNER = ["", "post", "sound", "editorial", "vfx", "marketing", "production", "other"];

const SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    items: {
      type: "array",
      description: "Every deliverable artifact, one entry each.",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Clear name of the deliverable artifact." },
          category: { type: "string", enum: CATEGORY },
          inScope: { type: "boolean", description: "True if it is post-production's responsibility; false for publicity/marketing." },
          owner: { type: "string", enum: OWNER, description: "Likely owner if not post." },
          notes: { type: "string", description: "Verbatim source quote, or 'Standard — confirm' if added from best practice." },
        },
        required: ["label", "category"],
      },
    },
  },
  required: ["items"],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(503).json({ error: "not_configured", message: "AI isn't set up yet — add ANTHROPIC_API_KEY to the Vercel project environment, then redeploy." }); return; }

  try {
    const body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) || {};
    const brief: string = typeof body.brief === "string" ? body.brief : "";
    const documents: { name: string; mediaType: string; dataBase64: string }[] = Array.isArray(body.documents) ? body.documents : [];
    if (!brief.trim() && documents.length === 0) { res.status(400).json({ error: "no_input", message: "Add a brief or attach a document." }); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [];
    if (brief.trim()) content.push({ type: "text", text: `BRIEF — what I've been told to deliver:\n${brief.slice(0, 200_000)}` });
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
    content.push({ type: "text", text: INSTRUCTION });

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ name: "deliverables_list", description: "Return the itemised deliverables punch-list.", input_schema: SCHEMA as any }],
      tool_choice: { type: "tool", name: "deliverables_list" },
      messages: [{ role: "user", content }],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUse = (msg.content as any[]).find((c) => c?.type === "tool_use");
    if (!toolUse) { res.status(502).json({ error: "no_extraction", message: "The model didn't return a list. Try a clearer brief." }); return; }
    res.status(200).json(toolUse.input);
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const code = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(code).json({ error: "ai_error", message: err.message || "AI request failed." });
  }
}
