/** Real cinema prime sets — the focal ladders DPs actually carry, with each set's
 *  wide-open T-stop. Used by the FOV tab to snap the focal slider to a kit's real
 *  primes and set a sensible aperture. Focal lengths are the spherical-equivalent
 *  marked focal (what the calculator's thin-lens model expects); anamorphic sets
 *  are noted — squeeze itself comes from the selected camera mode, not the kit.
 *
 *  Verified against manufacturer lens charts (ARRI, ZEISS, Cooke, Leitz, Panavision,
 *  Sigma) as of 2026 — confirm the exact set on a production by its rental list. */

export interface LensKit {
  id: string;
  name: string;
  maker: string;
  coverage: "S35" | "FF";          // image circle
  tStop: number;                    // wide-open T-stop (≈ f for DoF entry)
  focals: number[];                 // marked focal lengths (mm)
  anamorphic?: boolean;             // 2x squeeze set (squeeze is set by camera mode)
  note?: string;
}

export const LENS_KITS: LensKit[] = [
  {
    id: "arri-master-prime",
    name: "Master Prime",
    maker: "ARRI / ZEISS",
    coverage: "S35",
    tStop: 1.3,
    focals: [12, 14, 16, 18, 21, 25, 27, 32, 35, 40, 50, 65, 75, 100, 135, 150],
    note: "The S35 speed-and-sharpness benchmark. T1.3 across the set.",
  },
  {
    id: "cooke-s4i",
    name: "S4/i",
    maker: "Cooke",
    coverage: "S35",
    tStop: 2.0,
    focals: [12, 14, 16, 18, 21, 25, 27, 32, 35, 40, 50, 65, 75, 100, 135, 150, 180, 300],
    note: "The “Cooke Look” — warm, gentle roll-off. T2.0.",
  },
  {
    id: "zeiss-supreme",
    name: "Supreme Prime",
    maker: "ZEISS",
    coverage: "FF",
    tStop: 1.5,
    focals: [15, 18, 21, 25, 29, 35, 40, 50, 65, 85, 100, 135, 150, 200],
    note: "Full-frame / large-format clean and fast. T1.5.",
  },
  {
    id: "arri-signature",
    name: "Signature Prime",
    maker: "ARRI",
    coverage: "FF",
    tStop: 1.8,
    focals: [12, 15, 18, 21, 25, 29, 35, 40, 47, 58, 75, 95, 125, 150, 200, 280],
    note: "LF native, smooth and characterful. T1.8 (T2.5 at 280).",
  },
  {
    id: "leitz-summilux-c",
    name: "Summilux-C",
    maker: "Leitz / Leica",
    coverage: "S35",
    tStop: 1.4,
    focals: [16, 18, 21, 25, 29, 35, 40, 50, 65, 75, 100, 135],
    note: "Fast S35 primes, very low distortion. T1.4.",
  },
  {
    id: "panavision-primo",
    name: "Primo",
    maker: "Panavision",
    coverage: "S35",
    tStop: 1.9,
    focals: [10, 14.5, 17.5, 21, 27, 35, 40, 50, 65, 75, 100, 125, 150],
    note: "Panavision-mount rental classic. ~T1.9.",
  },
  {
    id: "sigma-ff-classic",
    name: "FF High Speed / Classic",
    maker: "Sigma",
    coverage: "FF",
    tStop: 1.5,
    focals: [14, 20, 24, 28, 35, 40, 50, 65, 85, 105, 135],
    note: "Affordable full-frame primes. T1.5.",
  },
  {
    id: "cooke-anamorphic-i",
    name: "Anamorphic/i (2×)",
    maker: "Cooke",
    coverage: "S35",
    tStop: 2.3,
    anamorphic: true,
    focals: [25, 32, 40, 50, 65, 75, 100, 135, 180, 300],
    note: "2× squeeze. Set the camera mode to an anamorphic mode for correct horizontal AOV.",
  },
  {
    id: "zeiss-master-anamorphic",
    name: "Master Anamorphic (2×)",
    maker: "ARRI / ZEISS",
    coverage: "S35",
    tStop: 1.9,
    anamorphic: true,
    focals: [28, 35, 40, 50, 60, 75, 100, 135],
    note: "2× squeeze, fast and clean. Set an anamorphic camera mode for correct framing.",
  },
];

/** The kit focal nearest a given focal length (for highlighting the active prime). */
export function nearestFocal(kit: LensKit, focal: number): number {
  return kit.focals.reduce((best, f) => (Math.abs(f - focal) < Math.abs(best - focal) ? f : best), kit.focals[0]);
}
