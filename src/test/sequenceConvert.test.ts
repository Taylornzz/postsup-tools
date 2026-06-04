import { describe, it, expect } from "vitest";
import { parseSequence, toEDL, eventsToCSV } from "@/lib/sequenceConvert";

const EDL = `TITLE: T
FCM: NON-DROP FRAME
001  AX       V     C        00:00:00:00 00:00:05:00 01:00:00:00 01:00:05:00
* FROM CLIP NAME: shot_010.mov`;

describe("sequence converter", () => {
  it("detects + parses a CMX3600 EDL", () => {
    const p = parseSequence(EDL, "x.edl");
    expect(p.format).toBe("edl");
    expect(p.events.length).toBe(1);
    expect(p.events[0].clip).toBe("shot_010.mov");
  });

  it("CSV round-trips EDL → CSV → events", () => {
    const csv = eventsToCSV(parseSequence(EDL, "x.edl").events);
    const p2 = parseSequence(csv, "x.csv");
    expect(p2.format).toBe("csv");
    expect(p2.events.length).toBe(1);
    expect(p2.events[0].clip).toBe("shot_010.mov");
    expect(p2.events[0].srcOut).toBe("00:00:05:00");
  });

  it("writes a CMX3600 EDL with FCM + clip name", () => {
    const out = toEDL(parseSequence(EDL, "x.edl").events, { title: "T", df: false, reelLong: true });
    expect(out).toContain("FCM: NON-DROP FRAME");
    expect(out).toContain("* FROM CLIP NAME: shot_010.mov");
    expect(out).toMatch(/001\s+AX/);
  });

  it("parses FCP7/xmeml XML to record timecode", () => {
    if (typeof DOMParser === "undefined") return; // node env without DOM — skip
    const xml = `<?xml version="1.0"?><xmeml version="5"><sequence><name>Seq</name><rate><timebase>25</timebase><ntsc>FALSE</ntsc></rate><media><video><track><clipitem><name>A</name><start>0</start><end>25</end><in>0</in><out>25</out><file><name>A.mov</name></file></clipitem></track></video></media></sequence></xmeml>`;
    const p = parseSequence(xml, "s.xml");
    expect(p.format).toBe("fcp7xml");
    expect(p.events.length).toBe(1);
    expect(p.events[0].clip).toBe("A.mov");
    expect(p.events[0].recOut).toBe("00:00:01:00"); // 25 frames @ 25 fps = 1 s
  });
});
