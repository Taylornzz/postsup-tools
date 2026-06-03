import { describe, it, expect } from "vitest";
import { tcToFrames, framesToTC } from "@/lib/postcalc";
import { parseEDL, edlToCSV } from "@/lib/edl";

describe("timecode", () => {
  it("24 fps NDF: one hour = 86400 frames", () => {
    expect(tcToFrames("01:00:00:00", 24, false)).toBe(86400);
    expect(framesToTC(86400, 24, false)).toBe("01:00:00:00");
  });

  it("25 fps: one hour = 90000 frames", () => {
    expect(tcToFrames("01:00:00:00", 25, false)).toBe(90000);
  });

  it("29.97 DF skips frame labels 00/01 at each minute (except every 10th)", () => {
    expect(tcToFrames("00:01:00;02", 30, true)).toBe(1800);
    expect(framesToTC(1800, 30, true)).toBe("00:01:00;02");
  });

  it("29.97 DF: one hour stays real-time (107892 frames)", () => {
    expect(tcToFrames("01:00:00:00", 30, true)).toBe(107892);
  });

  it("round-trips frame counts (DF and NDF)", () => {
    for (const f of [0, 1, 30, 1799, 1800, 1801, 17982, 107892, 250000])
      expect(tcToFrames(framesToTC(f, 30, true), 30, true)).toBe(f);
    for (const f of [0, 1, 23, 86399, 86400, 999999])
      expect(tcToFrames(framesToTC(f, 24, false), 24, false)).toBe(f);
  });

  it("rejects malformed timecode", () => {
    expect(tcToFrames("nope", 24, false)).toBeNull();
    expect(tcToFrames("01:99:00:00", 24, false)).toBeNull();
  });
});

describe("EDL parser", () => {
  const edl = `TITLE: TEST
FCM: NON-DROP FRAME
001  AX       V     C        00:00:00:00 00:00:05:00 01:00:00:00 01:00:05:00
* FROM CLIP NAME: shot_010.mov
002  AX       V     D    025 00:00:10:00 00:00:14:00 01:00:05:00 01:00:09:00
* FROM CLIP NAME: shot_020.mov`;

  it("parses title, events, clip names and dissolve duration", () => {
    const p = parseEDL(edl);
    expect(p.title).toBe("TEST");
    expect(p.events.length).toBe(2);
    expect(p.events[0].clip).toBe("shot_010.mov");
    expect(p.events[1].transition).toBe("D");
    expect(p.events[1].transDur).toBe("025");
    expect(p.events[1].recOut).toBe("01:00:09:00");
  });

  it("emits CSV with a header and one row per event", () => {
    const csv = edlToCSV(parseEDL(edl));
    expect(csv.split("\r\n").length).toBe(3);
    expect(csv).toContain("shot_020.mov");
  });
});
