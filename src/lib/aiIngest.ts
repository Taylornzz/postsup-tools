import {
  REGIONS, DR_OPTIONS, RESOLUTION_OPTIONS, FPS_OPTIONS, CONTAINER_OPTIONS,
  AUDIO_OPTIONS, SUBTITLE_OPTIONS, LOUDNESS_OPTIONS, TRUEPEAK_OPTIONS,
  newRecipient, type Recipient, type DRId, type Region,
} from "./deliverables";

/** Client side of the Deliverables AI ingest. Sends a delivery spec (PDF / image / text)
 *  to the /api/extract-recipients serverless function, then validates the model's output
 *  against the app's own option sets and maps it into real Recipient rows, with the
 *  per-field source quotes folded into each recipient's notes for verification. */

const ENDPOINT = "/api/extract-recipients";

function optionPayload() {
  return {
    region: REGIONS,
    dr: DR_OPTIONS.map((d) => d.id),
    resolution: RESOLUTION_OPTIONS,
    fps: FPS_OPTIONS,
    container: CONTAINER_OPTIONS,
    audio: AUDIO_OPTIONS,
    loudness: LOUDNESS_OPTIONS,
    truePeak: TRUEPEAK_OPTIONS,
    subtitles: SUBTITLE_OPTIONS,
  };
}

async function fileToDoc(file: File): Promise<{ name: string; mediaType: string; dataBase64: string }> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("read failed"));
    fr.readAsDataURL(file);
  });
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const mediaType = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "text/plain");
  return { name: file.name, mediaType, dataBase64: base64 };
}

type RawRecipient = {
  name?: unknown; region?: unknown; dr?: unknown; peakNits?: unknown; resolution?: unknown;
  fps?: unknown; container?: unknown; audio?: unknown; loudness?: unknown; truePeak?: unknown;
  subtitles?: unknown; textless?: unknown; notes?: unknown; sources?: unknown;
};

function pick<T>(val: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly unknown[]).includes(val) ? (val as T) : fallback;
}

function toRecipient(raw: RawRecipient): Recipient {
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Recipient";
  const r: Recipient = newRecipient(name);
  if (typeof raw.region === "string") r.region = pick<Region>(raw.region, REGIONS, r.region);
  if (typeof raw.dr === "string") r.dr = pick<DRId>(raw.dr as DRId, DR_OPTIONS.map((d) => d.id), r.dr);
  if (typeof raw.peakNits === "number" && raw.peakNits > 0) r.peakNits = raw.peakNits;
  if (typeof raw.resolution === "string") r.resolution = pick(raw.resolution, RESOLUTION_OPTIONS, r.resolution);
  if (typeof raw.fps === "number") r.fps = pick(raw.fps, FPS_OPTIONS, r.fps);
  if (typeof raw.container === "string") r.container = pick(raw.container, CONTAINER_OPTIONS, r.container);
  if (typeof raw.audio === "string") r.audio = pick(raw.audio, AUDIO_OPTIONS, r.audio);
  if (typeof raw.loudness === "string") r.loudness = pick(raw.loudness, LOUDNESS_OPTIONS, r.loudness);
  if (typeof raw.truePeak === "string") r.truePeak = pick(raw.truePeak, TRUEPEAK_OPTIONS, r.truePeak);
  if (typeof raw.subtitles === "string") r.subtitles = pick(raw.subtitles, SUBTITLE_OPTIONS, r.subtitles);
  if (typeof raw.textless === "boolean") r.textless = raw.textless;

  const lines: string[] = ["AI-extracted — verify against the real delivery spec."];
  if (typeof raw.notes === "string" && raw.notes.trim()) lines.push(raw.notes.trim());
  if (raw.sources && typeof raw.sources === "object") {
    for (const [k, v] of Object.entries(raw.sources as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) lines.push(`${k}: “${v.trim()}”`);
    }
  }
  r.notes = lines.join("\n");
  return r;
}

export async function ingestDeliverySpec(files: File[]): Promise<Recipient[]> {
  const documents = await Promise.all(files.map(fileToDoc));
  let resp: Response;
  try {
    resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documents, options: optionPayload() }),
    });
  } catch {
    throw new Error("Couldn’t reach the AI service — it only runs on the deployed site, not local dev.");
  }
  let data: { recipients?: unknown; message?: string } | null = null;
  try { data = await resp.json(); } catch { /* non-JSON */ }
  if (!resp.ok) {
    if (resp.status === 404) throw new Error("AI endpoint not found — it runs on the deployed site, not local vite dev.");
    throw new Error(data?.message || `Ingest failed (${resp.status}).`);
  }
  const rawList = Array.isArray(data?.recipients) ? (data!.recipients as RawRecipient[]) : [];
  if (rawList.length === 0) throw new Error("No delivery recipients found in that document.");
  return rawList.map(toRecipient);
}
