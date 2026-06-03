/** Post-production calculators — timecode, frame-rate conform, aspect ratio.
 *  Timecode math uses the canonical SMPTE drop-frame algorithm. */

export type FpsPreset = { id: string; label: string; nominal: number; actual: number; df: boolean };

/** nominal = the integer used in TC labels; actual = real rate; df = whether drop-frame applies. */
export const FPS_PRESETS: FpsPreset[] = [
  { id: "23.976", label: "23.976", nominal: 24, actual: 24000 / 1001, df: false },
  { id: "24", label: "24", nominal: 24, actual: 24, df: false },
  { id: "25", label: "25 (PAL)", nominal: 25, actual: 25, df: false },
  { id: "29.97df", label: "29.97 DF", nominal: 30, actual: 30000 / 1001, df: true },
  { id: "29.97ndf", label: "29.97 NDF", nominal: 30, actual: 30000 / 1001, df: false },
  { id: "30", label: "30", nominal: 30, actual: 30, df: false },
  { id: "50", label: "50", nominal: 50, actual: 50, df: false },
  { id: "59.94df", label: "59.94 DF", nominal: 60, actual: 60000 / 1001, df: true },
  { id: "59.94ndf", label: "59.94 NDF", nominal: 60, actual: 60000 / 1001, df: false },
  { id: "60", label: "60", nominal: 60, actual: 60, df: false },
];

const pad = (n: number) => String(n).padStart(2, "0");

export function parseTC(tc: string): { h: number; m: number; s: number; f: number } | null {
  const m = tc.trim().match(/^(\d{1,2})[:;](\d{1,2})[:;](\d{1,2})[:;.,](\d{1,3})$/);
  if (!m) return null;
  const h = +m[1], mm = +m[2], s = +m[3], f = +m[4];
  if (mm > 59 || s > 59) return null;
  return { h, m: mm, s, f };
}

/** TC string → absolute frame count. Returns null if the TC is malformed. */
export function tcToFrames(tc: string, nominal: number, df: boolean): number | null {
  const p = parseTC(tc);
  if (!p) return null;
  const { h, m, s, f } = p;
  if (f >= nominal) return null;
  if (df) {
    const dropFrames = Math.round(nominal * 0.0666666); // 2 @30, 4 @60
    const totalMinutes = 60 * h + m;
    return nominal * 60 * 60 * h + nominal * 60 * m + nominal * s + f - dropFrames * (totalMinutes - Math.floor(totalMinutes / 10));
  }
  return (h * 3600 + m * 60 + s) * nominal + f;
}

/** Absolute frame count → TC string (canonical SMPTE drop-frame algorithm). */
export function framesToTC(frameNumber: number, nominal: number, df: boolean): string {
  const neg = frameNumber < 0;
  let fn = Math.abs(Math.round(frameNumber));
  const sep = df ? ";" : ":";
  if (df) {
    const dropFrames = Math.round(nominal * 0.0666666);
    const framesPer10Min = nominal * 60 * 10 - dropFrames * 9;
    const framesPerMin = nominal * 60 - dropFrames;
    const d = Math.floor(fn / framesPer10Min);
    const mod = fn % framesPer10Min;
    fn += mod > dropFrames
      ? dropFrames * 9 * d + dropFrames * Math.floor((mod - dropFrames) / framesPerMin)
      : dropFrames * 9 * d;
  }
  const f = fn % nominal;
  const s = Math.floor(fn / nominal) % 60;
  const m = Math.floor(fn / (nominal * 60)) % 60;
  const h = Math.floor(fn / (nominal * 3600)) % 24;
  return `${neg ? "-" : ""}${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(f)}`;
}

export function framesToSeconds(frames: number, actual: number): number {
  return frames / actual;
}

/** Pretty wall-clock duration (e.g. 1h 02m 03.4s). */
export function fmtDuration(seconds: number): string {
  const neg = seconds < 0;
  let s = Math.abs(seconds);
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m || h) parts.push(`${pad(m)}m`);
  parts.push(`${s.toFixed(2)}s`);
  return (neg ? "-" : "") + parts.join(" ");
}

/** Conform N frames from one rate to another (re-time, same frame count). */
export function conform(frames: number, src: FpsPreset, tgt: FpsPreset) {
  const srcSeconds = frames / src.actual;
  const tgtSeconds = frames / tgt.actual;
  const speedPct = (srcSeconds === 0 ? 0 : (tgtSeconds / srcSeconds) * 100); // playback length as % of original
  const audioPullPct = (src.actual / tgt.actual) * 100; // audio must be scaled by src/tgt
  const semitones = src.actual && tgt.actual ? 12 * Math.log2(tgt.actual / src.actual) : 0;
  return { srcSeconds, tgtSeconds, speedPct, audioPullPct, semitones };
}

// ---- aspect ratio ----
function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }

const NAMED_RATIOS: { r: number; name: string }[] = [
  { r: 1.33, name: "4:3 (Academy TV)" },
  { r: 1.43, name: "IMAX 1.43" },
  { r: 1.5, name: "3:2" },
  { r: 1.66, name: "5:3 (Super 16)" },
  { r: 1.78, name: "16:9 (HD/UHD)" },
  { r: 1.85, name: "Flat (1.85)" },
  { r: 1.9, name: "DCI Full / 17:9" },
  { r: 2.0, name: "Univisium (2:1)" },
  { r: 2.2, name: "70mm (2.20)" },
  { r: 2.35, name: "Scope (2.35)" },
  { r: 2.39, name: "Scope (2.39)" },
  { r: 2.76, name: "Ultra Panavision" },
  { r: 0.5625, name: "9:16 (vertical)" },
  { r: 1.0, name: "1:1 (square)" },
];

export function aspectFromWH(w: number, h: number) {
  if (!w || !h) return null;
  const ratio = w / h;
  const iw = Math.round(w), ih = Math.round(h);
  const g = gcd(iw, ih) || 1;
  let nearest = NAMED_RATIOS[0];
  for (const n of NAMED_RATIOS) if (Math.abs(n.r - ratio) < Math.abs(nearest.r - ratio)) nearest = n;
  const within = Math.abs(nearest.r - ratio) <= 0.02;
  return {
    decimal: ratio,
    x1: `${ratio.toFixed(3)}:1`,
    simple: `${iw / g}:${ih / g}`,
    name: within ? nearest.name : `≈ ${nearest.name}`,
  };
}

/** Solve the missing dimension for a target ratio (decimal). */
export function solveDimension(ratio: number, opts: { width?: number; height?: number }) {
  if (opts.width != null && ratio) return { width: opts.width, height: opts.width / ratio };
  if (opts.height != null) return { width: opts.height * ratio, height: opts.height };
  return null;
}
