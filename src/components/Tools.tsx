import { useMemo, useState } from "react";
import { Clock, Gauge, RectangleHorizontal, FileCode2, Download, Copy, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  FPS_PRESETS, type FpsPreset, tcToFrames, framesToTC, framesToSeconds, fmtDuration, conform,
  aspectFromWH, solveDimension,
} from "@/lib/postcalc";
import { parseSequence, exportConverted, toEDL, eventsToCSV, FORMAT_LABEL, type OutFormat } from "@/lib/sequenceConvert";

type Sub = "tc" | "rate" | "aspect" | "edl";
const SUBS: { id: Sub; label: string; icon: typeof Clock }[] = [
  { id: "tc", label: "Timecode", icon: Clock },
  { id: "rate", label: "Frame Rate", icon: Gauge },
  { id: "aspect", label: "Aspect Ratio", icon: RectangleHorizontal },
  { id: "edl", label: "EDL Converter", icon: FileCode2 },
];

const getFps = (id: string): FpsPreset => FPS_PRESETS.find((f) => f.id === id) || FPS_PRESETS[1];

export function Tools() {
  const [sub, setSub] = useState<Sub>("tc");
  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col bg-suite-canvas">
      <div className="shrink-0 border-b border-suite-border bg-suite-panel px-5 py-2.5 flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs tracking-[0.14em] uppercase text-suite-text font-semibold mr-2">Post Tools</span>
        {SUBS.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.id} type="button" onClick={() => setSub(s.id)}
              className={cn("flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm transition-colors",
                sub === s.id ? "bg-status-ok/15 text-status-ok border-status-ok/50" : "text-suite-text-muted hover:text-suite-text border-suite-border hover:border-suite-border-strong bg-suite-bg")}>
              <Icon className="size-3" strokeWidth={1.6} /> {s.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
        {sub === "tc" && <TimecodeTool />}
        {sub === "rate" && <RateTool />}
        {sub === "aspect" && <AspectTool />}
        {sub === "edl" && <EdlTool />}
      </div>
    </div>
  );
}

// ---------- shared UI ----------
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-suite-border bg-suite-panel p-4 flex flex-col gap-3">
      <h3 className="font-mono text-[11px] tracking-[0.16em] uppercase text-suite-text-muted">{title}</h3>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-suite-text-dim">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full bg-suite-bg border border-suite-border rounded-sm px-2 py-1.5 text-[13px] font-mono text-suite-text focus:outline-none focus:border-guide-target [color-scheme:dark]";
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-suite-text-dim">{label}</span>
      <span className={cn("font-mono text-[15px] tabular", accent ? "text-guide-source" : "text-suite-text")}>{value}</span>
    </div>
  );
}
function FpsSelect({ value, onChange, label = "Frame rate" }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {FPS_PRESETS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
      </select>
    </Field>
  );
}

// ---------- Timecode ----------
function TimecodeTool() {
  const [fpsId, setFpsId] = useState("24");
  const fps = getFps(fpsId);
  const [tc, setTc] = useState("01:00:00:00");
  const [frames, setFrames] = useState("86400");
  const [aTc, setATc] = useState("01:00:00:00");
  const [bTc, setBTc] = useState("00:00:30:00");
  const [op, setOp] = useState<"+" | "-">("+");

  const tcFrames = tcToFrames(tc, fps.nominal, fps.df);
  const frInt = Math.round(Number(frames));
  const frTc = Number.isFinite(frInt) ? framesToTC(frInt, fps.nominal, fps.df) : "—";
  const aF = tcToFrames(aTc, fps.nominal, fps.df);
  const bF = tcToFrames(bTc, fps.nominal, fps.df);
  const resF = aF != null && bF != null ? (op === "+" ? aF + bF : aF - bF) : null;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <FpsSelect value={fpsId} onChange={setFpsId} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Card title="Timecode → frames">
          <Field label="Timecode"><input value={tc} onChange={(e) => setTc(e.target.value)} className={inputCls} placeholder="HH:MM:SS:FF" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Frames" value={tcFrames != null ? tcFrames.toLocaleString() : "invalid"} accent />
            <Stat label="Seconds" value={tcFrames != null ? fmtDuration(framesToSeconds(tcFrames, fps.actual)) : "—"} />
          </div>
        </Card>
        <Card title="Frames → timecode">
          <Field label="Frames"><input value={frames} onChange={(e) => setFrames(e.target.value)} inputMode="numeric" className={inputCls} placeholder="0" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Timecode" value={frTc} accent />
            <Stat label="Seconds" value={Number.isFinite(frInt) ? fmtDuration(framesToSeconds(frInt, fps.actual)) : "—"} />
          </div>
        </Card>
      </div>
      <Card title="Add / subtract timecode">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[130px]"><Field label="A"><input value={aTc} onChange={(e) => setATc(e.target.value)} className={inputCls} /></Field></div>
          <select value={op} onChange={(e) => setOp(e.target.value as "+" | "-")} className={cn(inputCls, "w-14 text-center")}><option value="+">+</option><option value="-">−</option></select>
          <div className="flex-1 min-w-[130px]"><Field label="B"><input value={bTc} onChange={(e) => setBTc(e.target.value)} className={inputCls} /></Field></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Result" value={resF != null ? framesToTC(resF, fps.nominal, fps.df) : "invalid"} accent />
          <Stat label="Frames" value={resF != null ? resF.toLocaleString() : "—"} />
        </div>
      </Card>
      <p className="font-mono text-[10px] text-suite-text-dim leading-relaxed">
        Drop-frame (29.97/59.94 DF) uses the SMPTE algorithm — the frame <em>labels</em> skip 2 (or 4) counts each minute except every tenth, so real-time stays accurate. NDF keeps every label but drifts ~3.6 s/hour from the clock.
      </p>
    </div>
  );
}

// ---------- Frame rate / conform ----------
function RateTool() {
  const [srcId, setSrcId] = useState("24");
  const [tgtId, setTgtId] = useState("25");
  const [dur, setDur] = useState("01:00:00:00");
  const src = getFps(srcId), tgt = getFps(tgtId);
  const frames = tcToFrames(dur, src.nominal, src.df);
  const c = frames != null ? conform(frames, src, tgt) : null;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <FpsSelect value={srcId} onChange={setSrcId} label="Source rate" />
        <FpsSelect value={tgtId} onChange={setTgtId} label="Target rate" />
      </div>
      <Card title="Source duration">
        <Field label="Duration (timecode @ source rate)"><input value={dur} onChange={(e) => setDur(e.target.value)} className={inputCls} placeholder="HH:MM:SS:FF" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Frames" value={frames != null ? frames.toLocaleString() : "invalid"} />
          <Stat label="Real runtime" value={frames != null ? fmtDuration(framesToSeconds(frames, src.actual)) : "—"} />
        </div>
      </Card>
      <Card title={`Conformed to ${tgt.label} (same frames, re-timed)`}>
        {c ? (
          <div className="grid sm:grid-cols-3 gap-3">
            <Stat label="New timecode" value={framesToTC(frames!, tgt.nominal, tgt.df)} accent />
            <Stat label="New runtime" value={fmtDuration(c.tgtSeconds)} accent />
            <Stat label="Length vs original" value={`${c.speedPct.toFixed(2)}%`} />
            <Stat label="Audio pull" value={`${c.audioPullPct.toFixed(3)}%`} />
            <Stat label="Pitch shift" value={`${c.semitones >= 0 ? "+" : ""}${c.semitones.toFixed(3)} st`} />
            <Stat label="Speed" value={c.speedPct < 100 ? "faster" : c.speedPct > 100 ? "slower" : "same"} />
          </div>
        ) : <p className="font-mono text-[11px] text-suite-text-dim">Enter a valid timecode.</p>}
      </Card>
      <p className="font-mono text-[10px] text-suite-text-dim leading-relaxed">
        Re-time = play the same frames at the new rate (no frames added/dropped). 24→25 is the classic PAL speed-up: 4% shorter and audio pulled up ~+0.71 st unless resampled. 23.976↔24 is the ±0.1% NTSC pull.
      </p>
    </div>
  );
}

// ---------- Aspect ratio ----------
function AspectTool() {
  const [w, setW] = useState("3840");
  const [h, setH] = useState("2160");
  const res = aspectFromWH(Number(w), Number(h));
  const [ratioW, setRatioW] = useState("2.39");
  const [base, setBase] = useState("4096");
  const [baseIsWidth, setBaseIsWidth] = useState(true);
  const ratio = Number(ratioW);
  const solved = ratio ? solveDimension(ratio, baseIsWidth ? { width: Number(base) } : { height: Number(base) }) : null;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <Card title="Width × height → ratio">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Width (px)"><input value={w} onChange={(e) => setW(e.target.value)} inputMode="numeric" className={inputCls} /></Field>
          <Field label="Height (px)"><input value={h} onChange={(e) => setH(e.target.value)} inputMode="numeric" className={inputCls} /></Field>
        </div>
        {res ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Ratio" value={res.x1} accent />
            <Stat label="Simplified" value={res.simple} />
            <Stat label="Decimal" value={res.decimal.toFixed(4)} />
            <Stat label="Standard" value={res.name} />
          </div>
        ) : <p className="font-mono text-[11px] text-suite-text-dim">Enter width and height.</p>}
      </Card>
      <Card title="Solve a dimension for a ratio">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="w-28"><Field label="Ratio (x:1)"><input value={ratioW} onChange={(e) => setRatioW(e.target.value)} inputMode="decimal" className={inputCls} /></Field></div>
          <select value={baseIsWidth ? "w" : "h"} onChange={(e) => setBaseIsWidth(e.target.value === "w")} className={cn(inputCls, "w-28")}>
            <option value="w">from width</option>
            <option value="h">from height</option>
          </select>
          <div className="flex-1 min-w-[120px]"><Field label={baseIsWidth ? "Width (px)" : "Height (px)"}><input value={base} onChange={(e) => setBase(e.target.value)} inputMode="numeric" className={inputCls} /></Field></div>
        </div>
        {solved ? (
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Width" value={Math.round(solved.width).toLocaleString()} accent={!baseIsWidth} />
            <Stat label="Height" value={Math.round(solved.height).toLocaleString()} accent={baseIsWidth} />
          </div>
        ) : null}
      </Card>
      <p className="font-mono text-[10px] text-suite-text-dim leading-relaxed">
        Handy for letterbox/pillarbox maths and crop targets — e.g. a 2.39 extraction from UHD 3840 wide → 1607 tall, or DCI Scope 4096×1716.
      </p>
    </div>
  );
}

// ---------- EDL converter ----------
const SAMPLE_EDL = `TITLE: SAMPLE SEQUENCE
FCM: NON-DROP FRAME
001  AX       V     C        00:00:00:00 00:00:05:00 01:00:00:00 01:00:05:00
* FROM CLIP NAME: shot_010.mov
002  AX       V     D    025 00:00:10:00 00:00:14:00 01:00:05:00 01:00:09:00
* FROM CLIP NAME: shot_020.mov`;

const OUTS: { id: OutFormat; label: string }[] = [
  { id: "xlsx", label: "XLSX — Excel" },
  { id: "csv", label: "CSV — spreadsheet" },
  { id: "edl", label: "EDL — CMX3600" },
  { id: "pdf", label: "PDF — cut list" },
  { id: "json", label: "JSON" },
];

function EdlTool() {
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");
  const [out, setOut] = useState<OutFormat>("xlsx");
  const [reelLong, setReelLong] = useState(true);
  const [titleOverride, setTitleOverride] = useState("");
  const [dfOverride, setDfOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    try { return { ok: true as const, ...parseSequence(text, filename) }; }
    catch (e) { return { ok: false as const, error: (e as Error).message }; }
  }, [text, filename]);

  const events = parsed?.ok ? parsed.events : [];
  const has = events.length > 0;
  const title = titleOverride.trim() || (parsed?.ok ? parsed.title : "") || "sequence";
  const df = dfOverride != null ? dfOverride : !!(parsed?.ok && parsed.df);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setFilename(f.name); f.text().then(setText);
  }
  function outText(): string | null {
    if (!has) return null;
    if (out === "edl") return toEDL(events, { title, df, reelLong });
    if (out === "csv") return eventsToCSV(events);
    if (out === "json") return JSON.stringify({ title, events }, null, 2);
    return null;
  }
  function copyOut() {
    const t = outText(); if (!t) return;
    navigator.clipboard.writeText(t).then(() => toast.success(`Copied as ${out.toUpperCase()}`));
  }
  async function go() {
    if (!has) return;
    setBusy(true);
    try { await exportConverted(out, events, { title, df, reelLong }); toast.success(`Exported ${out.toUpperCase()}`); }
    catch (err) { toast.error("Export failed: " + (err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4">
      <Card title="Source sequence">
        <textarea
          value={text} onChange={(e) => { setText(e.target.value); setFilename(""); }} spellCheck={false}
          placeholder="Paste an EDL, FCP7 / Premiere / Resolve XML, FCPXML or CSV — or load a file…"
          className="w-full h-36 bg-suite-bg border border-suite-border rounded-sm px-2 py-1.5 text-[11px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target resize-y"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm cursor-pointer text-suite-text-muted border-suite-border hover:text-suite-text bg-suite-bg">
            <Upload className="size-3" strokeWidth={1.6} /> Load file
            <input type="file" accept=".edl,.xml,.fcpxml,.csv,.txt,text/plain" onChange={onFile} className="hidden" />
          </label>
          <button type="button" onClick={() => { setText(SAMPLE_EDL); setFilename("sample.edl"); }} className="px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text bg-suite-bg">Sample EDL</button>
          <span className="flex-1" />
          {parsed?.ok && <span className="font-mono text-[10px] text-suite-text-dim">Detected <span className="text-status-ok">{FORMAT_LABEL[parsed.format]}</span> · {events.length} events{parsed.fps ? ` · ${parsed.fps} fps${parsed.df ? " DF" : ""}` : ""}</span>}
          {parsed && !parsed.ok && <span className="font-mono text-[10px] text-destructive">{parsed.error}</span>}
        </div>
      </Card>

      <Card title="Convert to">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="w-44"><Field label="Output format">
            <select value={out} onChange={(e) => setOut(e.target.value as OutFormat)} className={inputCls}>
              {OUTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field></div>
          <div className="flex-1 min-w-[160px]"><Field label="Title"><input value={title} onChange={(e) => setTitleOverride(e.target.value)} className={inputCls} /></Field></div>
          {out === "edl" && (
            <label className="flex items-center gap-1.5 font-mono text-[10px] text-suite-text-muted pb-2 whitespace-nowrap">
              <input type="checkbox" checked={reelLong} onChange={(e) => setReelLong(e.target.checked)} className="accent-guide-target" /> reel &gt; 8 chars
            </label>
          )}
          {(out === "edl" || out === "pdf") && (
            <label className="flex items-center gap-1.5 font-mono text-[10px] text-suite-text-muted pb-2 whitespace-nowrap">
              <input type="checkbox" checked={df} onChange={(e) => setDfOverride(e.target.checked)} className="accent-guide-target" /> drop-frame
            </label>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={!has || busy} onClick={go} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 disabled:opacity-40">
            <Download className="size-3" strokeWidth={1.6} /> {busy ? "Working…" : `Export ${out.toUpperCase()}`}
          </button>
          <button type="button" disabled={!outText()} onClick={copyOut} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text bg-suite-bg disabled:opacity-40">
            <Copy className="size-3" strokeWidth={1.6} /> Copy
          </button>
          <span className="font-mono text-[10px] text-suite-text-dim">Cut lists — transitions become cuts, audio-only tracks skipped.</span>
        </div>
      </Card>

      {has && (
        <Card title={`Preview · ${events.length} events`}>
          <div className="overflow-auto max-h-[45vh] -mx-1">
            <table className="w-full text-[11px] font-mono border-collapse">
              <thead className="sticky top-0 bg-suite-panel">
                <tr className="text-suite-text-dim text-left">
                  {["#", "Reel", "Trk", "Trans", "Clip", "Src In", "Src Out", "Rec In", "Rec Out"].map((h) => (
                    <th key={h} className="px-2 py-1 border-b border-suite-border font-normal tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={i} className="text-suite-text-muted hover:bg-suite-panel-elevated/40">
                    <td className="px-2 py-1 border-b border-suite-border/50 text-suite-text">{e.num}</td>
                    <td className="px-2 py-1 border-b border-suite-border/50">{e.reel}</td>
                    <td className="px-2 py-1 border-b border-suite-border/50">{e.track}</td>
                    <td className="px-2 py-1 border-b border-suite-border/50">{e.transition}{e.transDur ? ` ${e.transDur}` : ""}</td>
                    <td className="px-2 py-1 border-b border-suite-border/50 text-suite-text max-w-[220px] truncate" title={e.clip}>{e.clip || "—"}</td>
                    <td className="px-2 py-1 border-b border-suite-border/50 tabular">{e.srcIn}</td>
                    <td className="px-2 py-1 border-b border-suite-border/50 tabular">{e.srcOut}</td>
                    <td className="px-2 py-1 border-b border-suite-border/50 tabular">{e.recIn}</td>
                    <td className="px-2 py-1 border-b border-suite-border/50 tabular">{e.recOut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {!has && text.trim() && parsed?.ok && <p className="font-mono text-[11px] text-suite-text-dim">No events found — supported inputs: CMX3600 EDL, FCP7 / Premiere / Resolve XML, FCPXML, CSV.</p>}
    </div>
  );
}
