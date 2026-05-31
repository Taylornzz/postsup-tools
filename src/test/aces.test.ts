import { describe, it, expect } from "vitest";
import { SOURCE_FORMATS } from "@/lib/formats";
import { acesIdtForSource, acesOdtFor, acesPipeline } from "@/lib/aces";

const byId = (id: string) => {
  const s = SOURCE_FORMATS.find((x) => x.id === id);
  if (!s) throw new Error(`missing source ${id}`);
  return s;
};

describe("acesIdtForSource", () => {
  it("maps ARRI LogC4 to the official ARRI IDT", () => {
    const idt = acesIdtForSource(byId("alexa35-46k-og"));
    expect(idt.label).toMatch(/LogC4/);
    expect(idt.official).toBe(true);
  });
  it("maps ARRI LogC3 (ALEXA Mini) to the EI-dependent LogC3 IDT", () => {
    const idt = acesIdtForSource(byId("alexa-mini-34-og"));
    expect(idt.label).toMatch(/LogC3/);
    expect(idt.official).toBe(true);
  });
  it("maps Sony S-Log3 to S-Gamut3.Cine", () => {
    const idt = acesIdtForSource(byId("venice1-6k-og"));
    expect(idt.label).toMatch(/S-Gamut3\.Cine/);
    expect(idt.official).toBe(true);
  });
  it("maps RED Log3G10 to the official RED IDT", () => {
    const idt = acesIdtForSource(byId("komodo-6k-17"));
    expect(idt.label).toMatch(/Log3G10/);
    expect(idt.official).toBe(true);
  });
  it("maps Canon Log 2 to Cinema Gamut", () => {
    const idt = acesIdtForSource(byId("c700ff-59k"));
    expect(idt.label).toMatch(/Canon Log 2/);
    expect(idt.official).toBe(true);
  });
  it("flags Nikon N-Log as third-party (no official ACES IDT)", () => {
    const idt = acesIdtForSource(byId("nikon-z9-83k"));
    expect(idt.official).toBe(false);
    expect(idt.label).toMatch(/Nikon/);
  });
  it("flags Fujifilm F-Log2 as third-party (no official ACES IDT)", () => {
    const idt = acesIdtForSource(byId("gfx100ii-8k"));
    expect(idt.official).toBe(false);
    expect(idt.label).toMatch(/F-Log2/);
  });
});

describe("acesOdtFor", () => {
  it("SDR broadcast → Rec.709 BT.1886 100 nit", () => {
    const o = acesOdtFor("SDR", "UHD 4K");
    expect(o.display).toMatch(/Rec\.709/);
    expect(o.peakNits).toBe("100");
  });
  it("SDR DCI theatrical → P3-D65 48 nit gamma 2.6", () => {
    const o = acesOdtFor("SDR", "DCI 4K Scope");
    expect(o.peakNits).toBe("48");
    expect(o.eotf).toMatch(/2\.6/);
  });
  it("HDR10 and HDR10+ share the same PQ Output Transform", () => {
    expect(acesOdtFor("HDR10", "UHD 4K")).toBe(acesOdtFor("HDR10+", "UHD 4K"));
    expect(acesOdtFor("HDR10", "UHD 4K").eotf).toMatch(/PQ|ST\.?2084/);
  });
  it("HLG → 1000-nit P3-D65-limited (no full Rec.2020 HLG)", () => {
    const o = acesOdtFor("HLG", "UHD 4K");
    expect(o.eotf).toMatch(/HLG/);
    expect(o.display).toMatch(/P3-D65/);
  });
  it("Dolby Vision → PQ mastering pass, trims downstream", () => {
    const o = acesOdtFor("Dolby Vision P8.1", "UHD 4K");
    expect(o.eotf).toMatch(/PQ|ST\.?2084/);
    expect(o.note).toMatch(/downstream|trim/i);
  });
});

describe("acesPipeline", () => {
  it("uses the 1.3 ODT label when version is 1.3", () => {
    const p = acesPipeline(byId("alexa35-46k-og"), "SDR", "UHD 4K", "1.3");
    expect(p.version).toBe("1.3");
    expect(p.grade.name).toBe("ACEScct");
    expect(p.interchange.name).toMatch(/ACES2065-1/);
  });
});
