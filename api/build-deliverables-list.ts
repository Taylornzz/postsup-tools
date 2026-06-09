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
  "You are a senior post-production supervisor building the deliverables list for ONE recipient. You turn a brief " +
  "into a clean, itemised list of the distinct artifacts to hand over.\n\n" +
  "GRANULARITY — one item = one distinct artifact you physically deliver. Be disciplined:\n" +
  "• Audio mixes: ONE per configuration — a Stereo mix is one deliverable, a 5.1 mix is one, a 7.1 is one, an Atmos " +
  "mix is one. NEVER list the same mix under multiple names or channel maps (e.g. 'Stereo mix', 'Audio mix Stereo " +
  "(Ch 1&2)', 'Stereo (A1/A2)', 'Lt/Rt' are ONE item).\n" +
  "• M&E: ONE per configuration.\n" +
  "• Stems: ONE deliverable per configuration — the Dialogue/Music/Effects set together (note dipped vs undipped on " +
  "that one item). NEVER split into separate Dialogue, Music, Effects items.\n" +
  "• Picture: clean/textless master, texted master, textless elements — one each. Call it a " +
  "'Picture master' (or 'Programme master' for TV) — NEVER 'Feature master' unless it really is a theatrical " +
  "feature film; 'feature' means a film and is confusing on a TV title.\n" +
  "• Subtitles/captions: one per language + type.\n\n" +
  "NOT deliverables — NEVER list these as items; they are requirements baked into a master, so fold them into the " +
  "relevant master's note or omit: sync pop / 2-pop, 1kHz line-up tone, bars, slates, leaders, head/tail build, " +
  "timecode start, channel mapping/layout, audio sync, aspect/active-picture.\n\n" +
  "Consolidate ruthlessly — if two candidates are the same artifact worded differently, return ONE. Prefer a short, " +
  "correct list over a long granular one. Mark genuinely non-post items (publicity stills, cast bios, EPK, key art) " +
  "out of scope with an owner. Never invent specifics that contradict the brief; when vague, list the standard items " +
  "a delivery like this needs, noting 'confirm'.";

const INSTRUCTION =
  "Return this recipient's deliverables via the `deliverables_list` tool — ONE entry per DISTINCT artifact, no " +
  "duplicates, and with line-up / reference / QC requirements folded into a note rather than listed as their own " +
  "items. For each: a clear canonical `label` (e.g. 'Picture master — clean/textless', 'M&E — 5.1', 'Stems (D/M/E) — 5.1', " +
  "'Closed captions (EN SDH)'); its `category`; whether it is in post's scope (`inScope` false for " +
  "publicity/marketing/EPK/stills/bios); the likely `owner`; and a short `notes` (a source quote, the channel map, " +
  "or 'confirm'). Be especially careful not to over-split audio.";

const CATEGORY = ["picture", "audio", "subtitles", "metadata", "marketing", "other"];
const OWNER = ["", "post", "sound", "editorial", "vfx", "marketing", "production", "other"];

const SPEC_INSTRUCTION =
  "Also set the `recipient` object — this recipient's technical delivery spec: name, colour pipeline (dr), peak nits " +
  "(if HDR), resolution, fps, container, audio config, loudness, true-peak, subtitles — choosing ONLY allowed values. " +
  "If the brief is just a platform name (e.g. 'TVNZ', 'Netflix', 'BBC'), fill that platform's standard known delivery " +
  "spec and its name.\n" +
  "Match the CONTAINER to the territory's real broadcast standard, not a generic one:\n" +
  "• Streamers (Netflix, Max, Disney+, Paramount+) → IMF App 2E; Amazon / Apple also take ProRes.\n" +
  "• UK broadcasters (BBC, ITV, Channel 4, Sky UK) → AS-11 DPP (MXF).\n" +
  "• NZ & Australia broadcasters (TVNZ, Sky NZ, ABC / Seven / Nine / Ten AU) → XDCAM HD 50 (MXF OP1a) or ProRes — " +
  "NOT AS-11 DPP, which is UK-specific.\n" +
  "• US broadcasters → ProRes or XDCAM.\n" +
  "Only set fields you're reasonably confident about; omit the rest.";

type Opts = Record<string, (string | number)[]>;

function schema(opts: Opts, wantSpec: boolean): Record<string, unknown> {
  const en = (k: string) => (Array.isArray(opts[k]) && opts[k].length ? { enum: opts[k] } : {});
  const properties: Record<string, unknown> = {
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
  };
  if (wantSpec) {
    properties.recipient = {
      type: "object",
      description: "This recipient's technical delivery spec, inferred from the brief / platform.",
      properties: {
        name: { type: "string", description: "Platform / recipient name." },
        region: { type: "string", ...en("region") },
        dr: { type: "string", description: "Colour pipeline / dynamic range.", ...en("dr") },
        peakNits: { type: "number", description: "HDR peak luminance in nits (only when an HDR tier)." },
        resolution: { type: "string", ...en("resolution") },
        fps: { type: "number", description: "Delivery frame rate.", ...en("fps") },
        container: { type: "string", ...en("container") },
        audio: { type: "string", ...en("audio") },
        loudness: { type: "string", ...en("loudness") },
        truePeak: { type: "string", ...en("truePeak") },
        subtitles: { type: "string", ...en("subtitles") },
      },
    };
  }
  return { type: "object", properties, required: ["items"] };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(503).json({ error: "not_configured", message: "AI isn't set up yet — add ANTHROPIC_API_KEY to the Vercel project environment, then redeploy." }); return; }

  try {
    const body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) || {};
    const brief: string = typeof body.brief === "string" ? body.brief : "";
    const documents: { name: string; mediaType: string; dataBase64: string }[] = Array.isArray(body.documents) ? body.documents : [];
    const existing: { label?: string; category?: string }[] = Array.isArray(body.existing) ? body.existing : [];
    const specOptions: Opts = body.specOptions && typeof body.specOptions === "object" ? body.specOptions : {};
    const wantSpec: boolean = typeof body.wantSpec === "boolean" ? body.wantSpec : existing.length === 0;
    if (!brief.trim() && documents.length === 0) { res.status(400).json({ error: "no_input", message: "Add a brief or attach a document." }); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [];
    if (brief.trim()) content.push({ type: "text", text: `BRIEF — what I've been told to deliver:\n${brief.slice(0, 200_000)}` });
    for (const d of documents) {
      if (d.mediaType === "application/pdf") {
        content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: d.dataBase64 } });
      } else if (/^image\/(jpeg|png|gif|webp)$/.test(d.mediaType)) {
        content.push({ type: "image", source: { type: "base64", media_type: d.mediaType, data: d.dataBase64 } });
      } else if (/\.docx$/i.test(d.name || "") || d.mediaType.includes("wordprocessingml")) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const m: any = await import("mammoth");
          const extract = m.extractRawText || m.default?.extractRawText;
          const { value } = await extract({ buffer: Buffer.from(d.dataBase64 || "", "base64") });
          content.push({ type: "text", text: `--- ${d.name} (Word) ---\n${String(value).slice(0, 200_000)}` });
        } catch { content.push({ type: "text", text: `--- ${d.name} (Word — couldn't be read) ---` }); }
      } else if (/\.(xlsx|xls)$/i.test(d.name || "") || d.mediaType.includes("spreadsheetml") || d.mediaType.includes("ms-excel")) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mod: any = await import("xlsx");
          const XLSX = mod.read ? mod : mod.default;
          const wb = XLSX.read(Buffer.from(d.dataBase64 || "", "base64"), { type: "buffer" });
          const text = wb.SheetNames.map((sn: string) => `# ${sn}\n${XLSX.utils.sheet_to_csv(wb.Sheets[sn])}`).join("\n\n");
          content.push({ type: "text", text: `--- ${d.name} (Excel) ---\n${String(text).slice(0, 200_000)}` });
        } catch { content.push({ type: "text", text: `--- ${d.name} (Excel — couldn't be read) ---` }); }
      } else {
        const decoded = Buffer.from(d.dataBase64 || "", "base64").toString("utf8").slice(0, 200_000);
        content.push({ type: "text", text: `--- ${d.name} ---\n${decoded}` });
      }
    }
    if (existing.length) {
      const lines = existing.filter((e) => e && typeof e.label === "string").map((e) => `- ${e.label}${e.category ? ` [${e.category}]` : ""}`).join("\n");
      if (lines) content.push({ type: "text", text: `ALREADY ON THIS RECIPIENT'S LIST — do NOT repeat these or their equivalents (the same artifact worded differently). Only return genuinely NEW artifacts the brief implies that are still missing:\n${lines}` });
    }
    if (wantSpec) content.push({ type: "text", text: SPEC_INSTRUCTION });
    content.push({ type: "text", text: INSTRUCTION });

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ name: "deliverables_list", description: "Return the recipient spec (if asked) + the itemised deliverables punch-list.", input_schema: schema(specOptions, wantSpec) as any }],
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
