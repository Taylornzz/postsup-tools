/** CMX3600 EDL parser → structured events + CSV. Tolerant of the common variants
 *  (cuts, dissolves/wipes with a duration field, FROM/TO CLIP NAME comments, FCM). */

export type EdlEvent = {
  num: string;
  reel: string;
  track: string;
  transition: string;
  transDur?: string;
  srcIn: string;
  srcOut: string;
  recIn: string;
  recOut: string;
  clip?: string;
  comments: string[];
};

export type ParsedEDL = { title?: string; fcm?: string; events: EdlEvent[] };

const TC = "\\d{2}:\\d{2}:\\d{2}[:;]\\d{2}";
// EVENT REEL TRACK TRANS [DUR] SRCIN SRCOUT RECIN RECOUT
const EVENT_RE = new RegExp(
  `^(\\d{1,6})\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(?:(\\d{1,3})\\s+)?(${TC})\\s+(${TC})\\s+(${TC})\\s+(${TC})`,
);

export function parseEDL(text: string): ParsedEDL {
  const events: EdlEvent[] = [];
  let title: string | undefined;
  let fcm: string | undefined;
  let cur: EdlEvent | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (/^TITLE:/i.test(line)) { title = line.replace(/^TITLE:\s*/i, "").trim(); continue; }
    if (/^FCM:/i.test(line)) { fcm = line.replace(/^FCM:\s*/i, "").trim(); continue; }

    const m = line.match(EVENT_RE);
    if (m) {
      cur = {
        num: m[1], reel: m[2], track: m[3], transition: m[4], transDur: m[5],
        srcIn: m[6], srcOut: m[7], recIn: m[8], recOut: m[9], comments: [],
      };
      events.push(cur);
      continue;
    }
    if (/^\*/.test(line) && cur) {
      const c = line.replace(/^\*\s*/, "").trim();
      cur.comments.push(c);
      const fc = c.match(/^(?:FROM|TO)\s+CLIP NAME:\s*(.+)$/i);
      if (fc && !cur.clip) cur.clip = fc[1].trim();
    }
  }
  return { title, fcm, events };
}

export function edlToCSV(parsed: ParsedEDL): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows: string[][] = [["Event", "Reel", "Track", "Transition", "Clip", "Src In", "Src Out", "Rec In", "Rec Out"]];
  for (const e of parsed.events) {
    rows.push([e.num, e.reel, e.track, e.transition + (e.transDur ? ` ${e.transDur}` : ""), e.clip || "", e.srcIn, e.srcOut, e.recIn, e.recOut]);
  }
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}
