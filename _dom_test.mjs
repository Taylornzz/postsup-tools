import { JSDOM } from "jsdom";
const { window } = new JSDOM("");
global.DOMParser = window.DOMParser;
global.Element = window.Element;

// ---- helpers copied verbatim ----
const txt = (el, sel) => el?.querySelector(sel)?.textContent?.trim() ?? "";
const num = (el, sel, d = 0) => { const v = parseFloat(txt(el, sel)); return Number.isFinite(v) ? v : d; };
const reelTag = (s) => (s || "AX").replace(/\.[^.]+$/, "").toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 8) || "AX";
function rationalSec(s) {
  if (!s) return 0;
  const m = s.match(/^(-?\d+(?:\.\d+)?)(?:\/(\d+))?s?$/);
  if (!m) return 0;
  return m[2] ? +m[1] / +m[2] : +m[1];
}
// minimal framesToTC (NDF only for this trace; nominal=24)
const pad = (n)=>String(n).padStart(2,"0");
function framesToTC(fn0, nominal, df){
  let fn=Math.abs(Math.round(fn0)); const sep=df?";":":";
  const f=fn%nominal,s=Math.floor(fn/nominal)%60,m=Math.floor(fn/(nominal*60))%60,h=Math.floor(fn/(nominal*3600))%24;
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(f)}`;
}

// ---- FCP7XML parser copied verbatim ----
function parseFCP7XML(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Could not parse XML.");
  const seq = doc.querySelector("sequence");
  const title = txt(seq, ":scope > name") || undefined;
  const nominal = num(seq, ":scope > rate > timebase", 25) || 25;
  const df = (txt(seq, ":scope > timecode > displayformat") || "NDF").toUpperCase() === "DF";
  const seqTc = num(seq, ":scope > timecode > frame", 0);
  const events = [];
  let n = 1;
  const clips = Array.from(doc.querySelectorAll("media > video clipitem, video > track > clipitem"));
  const seen = new Set();
  for (const ci of clips) {
    if (seen.has(ci)) continue; seen.add(ci);
    const startF = num(ci, ":scope > start", -1);
    const endF = num(ci, ":scope > end", -1);
    if (startF < 0 || endF < 0) continue;
    const inF = num(ci, ":scope > in", 0);
    const outF = num(ci, ":scope > out", 0);
    const fileTc = num(ci, ":scope > file > timecode > frame", 0);
    const fileName = txt(ci, ":scope > file > name") || txt(ci, ":scope > name") || "clip";
    events.push({
      num: String(n++).padStart(3, "0"), reel: reelTag(fileName), track: "V", transition: "C",
      srcIn: framesToTC(fileTc + inF, nominal, df), srcOut: framesToTC(fileTc + outF, nominal, df),
      recIn: framesToTC(seqTc + startF, nominal, df), recOut: framesToTC(seqTc + endF, nominal, df),
      clip: fileName, comments: [],
    });
  }
  return { title, events, fps: nominal, df, format: "fcp7xml" };
}

// Realistic Premiere/FCP7 xmeml: clip starts at file TC 01:00:00:00 (=86400@24), uses in=12, out=132, placed at seq start 0
const fcp7 = `<?xml version="1.0"?>
<xmeml version="4">
 <sequence>
  <name>My Seq</name>
  <rate><timebase>24</timebase><ntsc>FALSE</ntsc></rate>
  <timecode><frame>0</frame><displayformat>NDF</displayformat></timecode>
  <media><video><track>
    <clipitem id="c1">
      <name>shot_010</name>
      <start>0</start><end>120</end>
      <in>12</in><out>132</out>
      <file id="f1"><name>shot_010.mov</name>
        <timecode><frame>86400</frame><displayformat>NDF</displayformat></timecode>
      </file>
    </clipitem>
  </track></video></media>
 </sequence>
</xmeml>`;
console.log("=== FCP7XML trace ===");
const r7 = parseFCP7XML(fcp7);
console.log(JSON.stringify(r7.events[0], null, 0));
console.log("Expected srcIn = fileTc(86400)+in(12)=86412 ->", framesToTC(86412,24,false), " got", r7.events[0].srcIn);
console.log("Expected srcOut= 86400+132=86532 ->", framesToTC(86532,24,false), " got", r7.events[0].srcOut);
console.log("recIn 0->00:00:00:00 got", r7.events[0].recIn, " recOut 120 ->", framesToTC(120,24,false), "got", r7.events[0].recOut);
console.log("NOTE: srcOut uses raw <out>; in xmeml <out> is EXCLUSIVE (one past last frame). srcOut therefore = last frame + 1.");

// ---- FCPXML parser copied verbatim ----
function parseFCPXML(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Could not parse FCPXML.");
  const formats = {};
  doc.querySelectorAll("resources > format").forEach((f) => { formats[f.getAttribute("id") || ""] = rationalSec(f.getAttribute("frameDuration")) || 1 / 25; });
  const assets = {};
  doc.querySelectorAll("resources > asset, resources > media").forEach((a) => { assets[a.getAttribute("id") || ""] = { name: a.getAttribute("name") || "clip", start: rationalSec(a.getAttribute("start")) }; });
  const seq = doc.querySelector("sequence");
  const df = (seq?.getAttribute("tcFormat") || "NDF").toUpperCase() === "DF";
  const frameDur = formats[seq?.getAttribute("format") || ""] || 1 / 25;
  const nominal = Math.round(1 / frameDur);
  const tcStart = rationalSec(seq?.getAttribute("tcStart") || "0s");
  const title = doc.querySelector("project")?.getAttribute("name") || doc.querySelector("event")?.getAttribute("name") || undefined;
  const toF = (s) => Math.round(s / frameDur);
  const events = [];
  let n = 1;
  const spine = seq?.querySelector("spine");
  const items = Array.from(spine?.children || []);
  for (const el of items) {
    const tag = el.tagName.toLowerCase();
    if (!/^(asset-clip|clip|ref-clip|sync-clip|video|title)$/.test(tag)) continue;
    const offset = rationalSec(el.getAttribute("offset"));
    const duration = rationalSec(el.getAttribute("duration"));
    const start = rationalSec(el.getAttribute("start"));
    if (duration <= 0) continue;
    const ref = el.getAttribute("ref") || "";
    const asset = assets[ref];
    const name = el.getAttribute("name") || asset?.name || "clip";
    const srcBase = (asset?.start || 0) + start;
    events.push({
      num: String(n++).padStart(3, "0"), reel: reelTag(name), track: "V", transition: "C",
      srcIn: framesToTC(toF(srcBase), nominal, df), srcOut: framesToTC(toF(srcBase + duration), nominal, df),
      recIn: framesToTC(toF(tcStart + offset), nominal, df), recOut: framesToTC(toF(tcStart + offset + duration), nominal, df),
      clip: name, comments: [],
    });
  }
  return { title, events, fps: nominal, df, format: "fcpxml" };
}

// Realistic FCPXML: asset start = 3600s (file TC 01:00:00:00), clip start = 3601s (in-point 1s in), duration 5s, offset 0
const fcpx = `<?xml version="1.0"?>
<fcpxml version="1.9">
 <resources>
  <format id="r1" frameDuration="1/24s"/>
  <asset id="a1" name="shot_010.mov" start="3600s" duration="60s"/>
 </resources>
 <project name="Proj">
  <sequence format="r1" tcStart="3600s" tcFormat="NDF">
   <spine>
    <asset-clip ref="a1" offset="0s" name="shot_010" start="3601s" duration="5s"/>
   </spine>
  </sequence>
 </project>
</fcpxml>`;
console.log("\n=== FCPXML trace ===");
const rx = parseFCPXML(fcpx);
console.log(JSON.stringify(rx.events[0], null, 0));
console.log("asset.start=3600s, clip.start=3601s => srcBase=7201s => srcIn frame", Math.round(7201*24), "=>", framesToTC(Math.round(7201*24),24,false));
console.log(">> But the correct source in-point is just clip.start=3601s => 02:00:01:00. The code's srcBase DOUBLE-ADDS asset.start, giving", rx.events[0].srcIn, "(~2 hours too high).");
