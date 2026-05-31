// Cinema capture formats and delivery containers.
// All resolutions are storage pixel dimensions. `squeeze` is the optical anamorphic
// squeeze factor — the displayed (desqueezed) aspect ratio = (width * squeeze) / height.

export type ColorSpace =
  | "ARRI Wide Gamut 4"
  | "ARRI Wide Gamut 3"
  | "REDWideGamutRGB"
  | "S-Gamut3.Cine"
  | "S-Gamut3"
  | "Cinema Gamut"
  | "Blackmagic Design Wide Gamut"
  | "Apple Log / P3"
  | "Rec.709";

export type Oetf =
  | "LogC4"
  | "LogC3"
  | "Log3G10"
  | "S-Log3"
  | "Canon Log 2"
  | "Canon Log 3"
  | "Film Gen 5"
  | "Apple Log"
  | "Rec.709";

export type SourceFormat = {
  id: string;
  camera: string;
  mode: string;
  width: number;
  height: number;
  squeeze: number; // 1.0 spherical, 1.3, 1.65, 1.8, 2.0 anamorphic
  /** Physical sensor dimensions (full active area of the imager). */
  sensorWidthMm?: number;
  sensorHeightMm?: number;
  /** Sensor area actually USED by this mode (smaller than full sensor for cropped/ana modes).
   *  When omitted, falls back to sensorWidth/Height. */
  usedSensorWidthMm?: number;
  usedSensorHeightMm?: number;
  /** True when the camera is rotated 90° for native vertical capture. */
  rotated?: boolean;
  /** Typical maximum frame rate for this exact readout mode (full-sensor modes
   *  are sensor-readout limited). Optional — only set where well-documented;
   *  used for a non-blocking "exceeds typical max" warning. */
  maxFps?: number;
  colorSpace?: ColorSpace;
  oetf?: Oetf;
  notes?: string;
};

export type HdrVariant = "SDR" | "HDR10" | "HDR10+" | "Dolby Vision P8.1" | "HLG";

export type AudioChannelConfig = "2.0" | "5.1" | "7.1" | "7.1.4 Atmos";

export type DeliveryAudio = {
  channels: AudioChannelConfig;
  /** Integrated loudness target (LUFS), e.g. -27 (Netflix), -24 (Amazon/BCAP), -14 (YouTube/Spotify). */
  lufs: number;
  /** True-peak ceiling in dBTP. -2 dBTP is standard for streaming. */
  truePeakDb: number;
  notes?: string;
};

/** Netflix Originals camera-approval status (late 2025).
 *  "approved"     — cleared for primary capture (≥90% of runtime)
 *  "limited"      — B-cam / specialty / non-fiction only
 *  "not-approved" — cannot be used for primary capture on a Netflix Original */
export type NetflixStatus = "approved" | "limited" | "not-approved";

export type TargetContainer = {
  id: string;
  group: "Broadcast" | "Cinema" | "Social" | "Mastering";
  name: string;
  width: number;
  height: number;
  ratioLabel: string; // e.g. "2.39:1"
  /** Optional active picture area inside the storage frame (e.g. 2:1 in 16:9).
   *  When set, the deliverable is letterboxed/pillarboxed inside the storage frame.
   *  Extraction targets the ACTIVE aspect, not the storage aspect. */
  activeWidth?: number;
  activeHeight?: number;
  /** HDR variants this target supports (first is the default presentation). */
  hdrVariants?: HdrVariant[];
  /** Standard audio delivery for this target (default channel layout). */
  audio?: DeliveryAudio;
  /** Optional list of supported audio channel layouts — first is the default. */
  audioVariants?: AudioChannelConfig[];
};

// --- Source formats ---------------------------------------------------------
// Color/transfer defaults per vendor:
//   ARRI ALEXA 35  → ARRI Wide Gamut 4 / LogC4
//   ARRI legacy    → ARRI Wide Gamut 3 / LogC3
//   RED            → REDWideGamutRGB / Log3G10
//   Sony VENICE/BURANO/FX → S-Gamut3.Cine / S-Log3
//   Canon Cinema EOS    → Cinema Gamut / Canon Log 2
//   Canon broadcast/MILC → Cinema Gamut / Canon Log 3
//   Blackmagic     → Blackmagic Design Wide Gamut / Film Gen 5
//   iPhone         → Apple Log / P3 / Apple Log
//   ENG / broadcast → Rec.709 / Rec.709
export const SOURCE_FORMATS: SourceFormat[] = [
  // ============ ARRI ============
  {
    id: "alexa35-46k-og",
    camera: "ARRI ALEXA 35",
    mode: "4.6K 3:2 Open Gate",
    width: 4608,
    height: 3164,
    squeeze: 1,
    maxFps: 75,
    sensorWidthMm: 27.99,
    sensorHeightMm: 19.22,
    colorSpace: "ARRI Wide Gamut 4",
    oetf: "LogC4",
  },
  {
    id: "alexa35-44k-169",
    camera: "ARRI ALEXA 35",
    mode: "4.4K 16:9",
    width: 4448,
    height: 2502,
    squeeze: 1,
    sensorWidthMm: 27.02,
    sensorHeightMm: 15.20,
    colorSpace: "ARRI Wide Gamut 4",
    oetf: "LogC4",
  },
  {
    // §B.1 fix: ARRI ALEXA 35 has no 4.4K 4:3 2x ana mode. The pixel data
    // (3328×2790) is the published 3.3K 6:5 2x Anamorphic mode. Renamed.
    id: "alexa35-44k-2x-ana",
    camera: "ARRI ALEXA 35",
    mode: "3.3K 6:5 2x Anamorphic",
    width: 3328,
    height: 2790,
    squeeze: 2,
    sensorWidthMm: 27.99,
    sensorHeightMm: 19.22,
    usedSensorWidthMm: 20.22,
    usedSensorHeightMm: 16.94,
    colorSpace: "ARRI Wide Gamut 4",
    oetf: "LogC4",
    notes:
      "Industry-named '4:3 ana' but actual photosite area is 6:5 due to 4.4K-vs-3.3K sensor layout.",
  },
  {
    id: "alexa35-3k-13x-ana",
    camera: "ARRI ALEXA 35",
    mode: "3.8K 6:5 1.3x Anamorphic",
    width: 3840,
    height: 3164,
    squeeze: 1.3,
    sensorWidthMm: 27.99,
    sensorHeightMm: 19.22,
    usedSensorWidthMm: 23.33,
    usedSensorHeightMm: 19.22,
    colorSpace: "ARRI Wide Gamut 4",
    oetf: "LogC4",
  },
  {
    id: "alexa-lf-og",
    camera: "ARRI ALEXA LF",
    mode: "4.5K LF Open Gate",
    width: 4448,
    height: 3096,
    squeeze: 1,
    sensorWidthMm: 36.70,
    sensorHeightMm: 25.54,
    colorSpace: "ARRI Wide Gamut 3",
    oetf: "LogC3",
  },
  {
    id: "alexa-lf-2x-ana",
    camera: "ARRI ALEXA LF",
    mode: "LF 4:3 2x Anamorphic",
    width: 3424,
    height: 2790,
    squeeze: 2,
    sensorWidthMm: 36.70,
    sensorHeightMm: 25.54,
    usedSensorWidthMm: 28.25,
    usedSensorHeightMm: 23.01,
    colorSpace: "ARRI Wide Gamut 3",
    oetf: "LogC3",
  },
  {
    id: "alexa-lf-165-ana",
    camera: "ARRI ALEXA LF",
    mode: "LF 16:9 1.65x Ana (Hawk65)",
    width: 4448,
    height: 2502,
    squeeze: 1.65,
    sensorWidthMm: 36.70,
    sensorHeightMm: 25.54,
    usedSensorWidthMm: 36.70,
    usedSensorHeightMm: 20.65,
    colorSpace: "ARRI Wide Gamut 3",
    oetf: "LogC3",
  },
  {
    id: "alexa-mini-lf-og",
    camera: "ARRI ALEXA Mini LF",
    mode: "4.5K LF Open Gate",
    width: 4448,
    height: 3096,
    squeeze: 1,
    sensorWidthMm: 36.70,
    sensorHeightMm: 25.54,
    colorSpace: "ARRI Wide Gamut 3",
    oetf: "LogC3",
  },
  {
    id: "alexa-mini-lf-2x-ana",
    camera: "ARRI ALEXA Mini LF",
    mode: "LF 4:3 2x Anamorphic",
    width: 3424,
    height: 2790,
    squeeze: 2,
    sensorWidthMm: 36.70,
    sensorHeightMm: 25.54,
    usedSensorWidthMm: 28.25,
    usedSensorHeightMm: 23.01,
    colorSpace: "ARRI Wide Gamut 3",
    oetf: "LogC3",
  },
  {
    id: "alexa65-65k-og",
    camera: "ARRI ALEXA 65",
    mode: "6.5K Open Gate",
    width: 6560,
    height: 3100,
    squeeze: 1,
    sensorWidthMm: 54.12,
    sensorHeightMm: 25.58,
    colorSpace: "ARRI Wide Gamut 3",
    oetf: "LogC3",
  },
  {
    id: "alexa65-2x-ana",
    camera: "ARRI ALEXA 65",
    mode: "4.3K 4:3 2x Anamorphic",
    width: 4320,
    height: 3592,
    squeeze: 2,
    sensorWidthMm: 54.12,
    sensorHeightMm: 25.58,
    usedSensorWidthMm: 35.64,
    usedSensorHeightMm: 29.62,
    colorSpace: "ARRI Wide Gamut 3",
    oetf: "LogC3",
  },

  // ============ RED ============
  // VV pixel pitch = 5.0 µm (40.96 mm / 8192 px). Used sensor width = recorded × 0.005 mm.
  {
    // §B.2 fix: 8192×4320 = 1.896:1 = 17:9, NOT 16:9. RED docs label this 8K VV 17:9.
    id: "raptor-vv-8k-169",
    camera: "RED V-RAPTOR [X] VV",
    mode: "8K VV 17:9",
    width: 8192,
    height: 4320,
    squeeze: 1,
    sensorWidthMm: 40.96,
    sensorHeightMm: 21.60,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
  },
  {
    // §B.6 fix: anamorphic uses 5760 px of sensor, NOT full 8192 px → 28.80 mm wide.
    id: "raptor-vv-8k-43-2x-ana",
    camera: "RED V-RAPTOR [X] VV",
    mode: "8K VV 4:3 2x Anamorphic",
    width: 5760,
    height: 4320,
    squeeze: 2,
    sensorWidthMm: 40.96,
    sensorHeightMm: 21.60,
    usedSensorWidthMm: 28.80,
    usedSensorHeightMm: 21.60,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
    notes:
      "Industry-named '4:3 ana'; actual photosite area is 6:5 (5760×4320). Crops 28.80 mm of the 40.96 mm sensor width.",
  },
  {
    id: "raptor-vv-8k-65-2x-ana",
    camera: "RED V-RAPTOR [X] VV",
    mode: "8K VV 6:5 2x Anamorphic",
    width: 5184,
    height: 4320,
    squeeze: 2,
    sensorWidthMm: 40.96,
    sensorHeightMm: 21.60,
    usedSensorWidthMm: 25.92,
    usedSensorHeightMm: 21.60,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
  },
  {
    id: "raptor-vv-8k-169-15x-ana",
    camera: "RED V-RAPTOR [X] VV",
    mode: "8K VV 16:9 1.5x Anamorphic",
    width: 7680,
    height: 4320,
    squeeze: 1.5,
    sensorWidthMm: 40.96,
    sensorHeightMm: 21.60,
    usedSensorWidthMm: 38.40,
    usedSensorHeightMm: 21.60,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
  },
  {
    id: "raptor-vv-8k-179-13x-ana",
    camera: "RED V-RAPTOR [X] VV",
    mode: "8K VV 17:9 1.3x Anamorphic",
    width: 8192,
    height: 4320,
    squeeze: 1.3,
    sensorWidthMm: 40.96,
    sensorHeightMm: 21.60,
    usedSensorWidthMm: 40.96,
    usedSensorHeightMm: 21.60,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
  },
  {
    // The S35 sensor is 26.21×13.82 mm (8192×4320, 17:9). It has no 7K 4:3 mode —
    // that exists only on the larger 8K VV sensor. The real S35 4:3 2x mode is
    // 8K 4:3 = 5760×4320 using an 18.43×13.82 mm photosite area. (Verified vs RED docs.)
    id: "raptor-s35-8k-43-2x-ana",
    camera: "RED V-RAPTOR [X] S35",
    mode: "8K S35 4:3 2x Anamorphic",
    width: 5760,
    height: 4320,
    squeeze: 2,
    sensorWidthMm: 26.21,
    sensorHeightMm: 13.82,
    usedSensorWidthMm: 18.43,
    usedSensorHeightMm: 13.82,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
  },
  {
    id: "raptor-s35-6k-179-13x-ana",
    camera: "RED V-RAPTOR [X] S35",
    mode: "6K S35 17:9 1.3x Anamorphic",
    width: 6144,
    height: 3240,
    squeeze: 1.3,
    sensorWidthMm: 26.21,
    sensorHeightMm: 13.82,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
  },
  {
    id: "monstro-vv-8k-og",
    camera: "RED MONSTRO 8K VV",
    mode: "8K VV Open Gate",
    width: 8192,
    height: 4320,
    squeeze: 1,
    sensorWidthMm: 40.96,
    sensorHeightMm: 21.60,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
  },
  {
    // §B.6 fix: same VV pixel-pitch crop as V-Raptor.
    id: "monstro-vv-8k-43-2x-ana",
    camera: "RED MONSTRO 8K VV",
    mode: "8K VV 4:3 2x Anamorphic",
    width: 5760,
    height: 4320,
    squeeze: 2,
    sensorWidthMm: 40.96,
    sensorHeightMm: 21.60,
    usedSensorWidthMm: 28.80,
    usedSensorHeightMm: 21.60,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
  },
  {
    id: "monstro-vv-8k-179-13x-ana",
    camera: "RED MONSTRO 8K VV",
    mode: "8K VV 17:9 1.3x Anamorphic",
    width: 8192,
    height: 4320,
    squeeze: 1.3,
    sensorWidthMm: 40.96,
    sensorHeightMm: 21.60,
    usedSensorWidthMm: 40.96,
    usedSensorHeightMm: 21.60,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
  },
  {
    id: "komodo-x-6k-17",
    camera: "RED KOMODO-X",
    mode: "6K S35 17:9",
    width: 6144,
    height: 3240,
    squeeze: 1,
    sensorWidthMm: 27.03,
    sensorHeightMm: 14.26,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
  },

  // ============ SONY ============
  {
    id: "venice2-86k-og",
    camera: "Sony VENICE 2",
    mode: "8.6K 3:2 Open Gate",
    width: 8640,
    height: 5760,
    squeeze: 1,
    maxFps: 30,
    sensorWidthMm: 35.90,
    sensorHeightMm: 24.00,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    id: "venice2-86k-17",
    camera: "Sony VENICE 2",
    mode: "8.6K 17:9",
    width: 8640,
    height: 4556,
    squeeze: 1,
    sensorWidthMm: 35.9,
    sensorHeightMm: 18.94,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    id: "venice2-43-2x",
    camera: "Sony VENICE 2",
    mode: "5.8K 6:5 2x Anamorphic",
    width: 5792,
    height: 4854,
    squeeze: 2,
    sensorWidthMm: 35.90,
    sensorHeightMm: 24.00,
    usedSensorWidthMm: 24.07,
    usedSensorHeightMm: 20.17,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    // §B.3 fix: previous "8.2K 6:5 1.3x Ana" at 8192×6840 was impossible
    // (sensor is 8640×5760 max — 6840 rows > 5760). Replaced with the real
    // VENICE 2 6.2K 1.3x ana mode (6048×5067, 24.97×20.92 mm of sensor).
    id: "venice2-65-13x",
    camera: "Sony VENICE 2",
    mode: "6.2K 6:5 1.3x Anamorphic",
    width: 6048,
    height: 5067,
    squeeze: 1.3,
    sensorWidthMm: 35.90,
    sensorHeightMm: 24.00,
    usedSensorWidthMm: 25.13,
    usedSensorHeightMm: 21.05,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
    notes:
      "Real VENICE 2 1.3x ana mode (replaces v1.3's impossible 8.2K entry — that exceeded sensor row count).",
  },
  {
    // Real VENICE 2 8K-sensor anamorphic mode (replaces a fabricated "7.6K 17:9
    // 1.8x" entry — 1.8x is a de-squeeze MONITORING option, not a recording mode).
    id: "venice2-58k-65-2x",
    camera: "Sony VENICE 2",
    mode: "5.8K 6:5 2x Anamorphic",
    width: 5760,
    height: 4800,
    squeeze: 2,
    sensorWidthMm: 35.90,
    sensorHeightMm: 24.00,
    usedSensorWidthMm: 23.93,
    usedSensorHeightMm: 20.00,
    maxFps: 48,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
    notes: "Documented VENICE 2 8K-sensor anamorphic mode (CBKZ-3620A license); 2x desqueeze → 2.40:1.",
  },
  {
    id: "burano-86k-og",
    camera: "Sony BURANO",
    mode: "8.6K Full Frame Open Gate",
    width: 8640,
    height: 5760,
    squeeze: 1,
    maxFps: 30,
    sensorWidthMm: 35.90,
    sensorHeightMm: 24.00,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    id: "burano-43-2x",
    camera: "Sony BURANO",
    mode: "5.8K 6:5 2x Anamorphic",
    width: 5792,
    height: 4854,
    squeeze: 2,
    sensorWidthMm: 35.90,
    sensorHeightMm: 24.00,
    usedSensorWidthMm: 24.07,
    usedSensorHeightMm: 20.17,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    id: "fx9-uhd",
    camera: "Sony FX9",
    mode: "UHD 16:9 (FF)",
    width: 3840,
    height: 2160,
    squeeze: 1,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    id: "fx6-uhd",
    camera: "Sony FX6",
    mode: "UHD 16:9",
    width: 3840,
    height: 2160,
    squeeze: 1,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    id: "fx3-uhd",
    camera: "Sony FX3",
    mode: "UHD 16:9",
    width: 3840,
    height: 2160,
    squeeze: 1,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    id: "a7sIII-uhd",
    camera: "Sony α7S III",
    mode: "UHD 16:9 4:2:2 10-bit",
    width: 3840,
    height: 2160,
    squeeze: 1,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },

  // ============ SONY HD / BROADCAST ============
  {
    id: "venice2-hd-downsample",
    camera: "Sony VENICE 2",
    mode: "HD 1080p (downsampled)",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
    notes: "Internal HD recording from oversampled sensor.",
  },
  {
    id: "burano-hd-downsample",
    camera: "Sony BURANO",
    mode: "HD 1080p (downsampled)",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    id: "fx9-hd-ff",
    camera: "Sony FX9",
    mode: "HD 1080p 16:9 (FF)",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    id: "fx6-hd",
    camera: "Sony FX6",
    mode: "HD 1080p 16:9",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    id: "fx3-hd",
    camera: "Sony FX3",
    mode: "HD 1080p 16:9",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    id: "fs7-hd",
    camera: "Sony PXW-FS7",
    mode: "HD 1080p XAVC-I",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    id: "fs7-uhd",
    camera: "Sony PXW-FS7",
    mode: "UHD 4K XAVC-L",
    width: 3840,
    height: 2160,
    squeeze: 1,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    id: "z750-hd",
    camera: "Sony PXW-Z750 (ENG)",
    mode: "HD 1080p XAVC-I",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "Rec.709",
    oetf: "Rec.709",
    notes: "Broadcast ENG shoulder-mount, 2/3\" 3-CMOS.",
  },
  {
    id: "z280-hd",
    camera: "Sony PXW-Z280 (ENG)",
    mode: "HD 1080p XAVC LongGOP 50 Mbps",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "Rec.709",
    oetf: "Rec.709",
  },
  {
    id: "a7sIII-hd",
    camera: "Sony α7S III",
    mode: "HD 1080p 4:2:2 10-bit",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },

  // ============ ARRI HD ============
  {
    id: "alexa35-hd-downsample",
    camera: "ARRI ALEXA 35",
    mode: "HD 1080p (downsampled)",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "ARRI Wide Gamut 4",
    oetf: "LogC4",
  },
  {
    id: "alexa-mini-lf-hd",
    camera: "ARRI ALEXA Mini LF",
    mode: "HD 1080p (downsampled)",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "ARRI Wide Gamut 3",
    oetf: "LogC3",
  },
  {
    id: "amira-hd",
    camera: "ARRI AMIRA",
    mode: "HD 1080p ProRes",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "ARRI Wide Gamut 3",
    oetf: "LogC3",
  },

  // ============ RED / CANON / BMD HD ============
  {
    id: "komodo-x-hd",
    camera: "RED KOMODO-X",
    mode: "HD 1080p (downsampled)",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
  },
  {
    id: "c300iii-hd",
    camera: "Canon EOS C300 Mk III",
    mode: "HD 1080p XF-AVC",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "Cinema Gamut",
    oetf: "Canon Log 2",
  },
  {
    id: "c70-hd",
    camera: "Canon EOS C70",
    mode: "HD 1080p XF-AVC",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "Cinema Gamut",
    oetf: "Canon Log 2",
  },
  {
    id: "bmpcc-hd",
    camera: "Blackmagic Pocket 6K Pro",
    mode: "HD 1080p ProRes",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "Blackmagic Design Wide Gamut",
    oetf: "Film Gen 5",
  },
  {
    id: "ursa-hd",
    camera: "Blackmagic URSA Cine 12K LF",
    mode: "HD 1080p (downsampled)",
    width: 1920,
    height: 1080,
    squeeze: 1,
    colorSpace: "Blackmagic Design Wide Gamut",
    oetf: "Film Gen 5",
  },

  // ============ BLACKMAGIC ============
  {
    // §B.9 fix: URSA Cine 12K LF sensor is 35.64×23.32 mm, not 36×24.
    id: "ursa-12k-og",
    camera: "Blackmagic URSA Cine 12K LF",
    mode: "12K Open Gate 3:2",
    width: 12288,
    height: 8040,
    squeeze: 1,
    maxFps: 60,
    sensorWidthMm: 35.64,
    sensorHeightMm: 23.32,
    colorSpace: "Blackmagic Design Wide Gamut",
    oetf: "Film Gen 5",
  },
  {
    id: "ursa-12k-17",
    camera: "Blackmagic URSA Cine 12K LF",
    mode: "12K 17:9",
    width: 12288,
    height: 6480,
    squeeze: 1,
    sensorWidthMm: 35.64,
    sensorHeightMm: 23.32,
    colorSpace: "Blackmagic Design Wide Gamut",
    oetf: "Film Gen 5",
  },
  {
    // §B.5 fix: 8192×6912 = 1.185:1 = 6:5, NOT 4:3 (1.333). Renamed and added sensor dims.
    id: "ursa-12k-2x-ana",
    camera: "Blackmagic URSA Cine 12K LF",
    mode: "8K 6:5 2x Anamorphic",
    width: 8192,
    height: 6912,
    squeeze: 2,
    sensorWidthMm: 35.64,
    sensorHeightMm: 23.32,
    usedSensorWidthMm: 23.76,
    usedSensorHeightMm: 20.05,
    colorSpace: "Blackmagic Design Wide Gamut",
    oetf: "Film Gen 5",
    notes: "Industry-named '4:3 ana'; actual photosite area is 6:5.",
  },
  {
    id: "bmpcc-6k-og",
    camera: "Blackmagic Pocket 6K Pro",
    mode: "6K S35 16:9 Full Sensor",
    width: 6144,
    height: 3456,
    squeeze: 1,
    sensorWidthMm: 23.10,
    sensorHeightMm: 12.99,
    colorSpace: "Blackmagic Design Wide Gamut",
    oetf: "Film Gen 5",
  },

  // ============ CANON ============
  {
    id: "c500ii-59k-og",
    camera: "Canon EOS C500 Mk II",
    mode: "5.9K Full Frame (17:9)", // 5952×3140 = 1.896:1 (17:9), not a 3:2 open gate
    width: 5952,
    height: 3140,
    squeeze: 1,
    sensorWidthMm: 38.10,
    sensorHeightMm: 20.10,
    colorSpace: "Cinema Gamut",
    oetf: "Canon Log 2",
  },
  {
    // §B.9 fix: 6000×3164 is the 17:9 6K RAW recording frame (not a 3:2 capture).
    id: "c400-6k-og",
    camera: "Canon EOS C400",
    mode: "6K Full-Sensor Readout (17:9)",
    width: 6000,
    height: 3164,
    squeeze: 1,
    sensorWidthMm: 38.10,
    sensorHeightMm: 20.10,
    colorSpace: "Cinema Gamut",
    oetf: "Canon Log 2",
  },
  {
    id: "c70-uhd",
    camera: "Canon EOS C70",
    mode: "DCI 4K Super35",
    width: 4096,
    height: 2160,
    squeeze: 1,
    colorSpace: "Cinema Gamut",
    oetf: "Canon Log 2",
  },
  {
    // §B.9 fix: 8192×4320 is DCI 17:9, not generic '8K Full Frame'. R5 C also
    // supports 8192×5464 (3:2 OG). Disambiguating this entry as DCI 17:9.
    id: "r5c-8k-raw",
    camera: "Canon EOS R5 C",
    mode: "8K DCI 17:9 RAW",
    width: 8192,
    height: 4320,
    squeeze: 1,
    sensorWidthMm: 36.00,
    sensorHeightMm: 19.00,
    colorSpace: "Cinema Gamut",
    oetf: "Canon Log 3",
  },

  // ============ PANAVISION / OTHER CINEMA ============
  {
    id: "panavision-dxl2-8k-og",
    camera: "Panavision Millennium DXL2",
    mode: "8K VV Open Gate",
    width: 8192,
    height: 4320,
    squeeze: 1,
    sensorWidthMm: 40.96,
    sensorHeightMm: 21.60,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
  },
  {
    // §B.4 fix: previous 6144×5120 was IMPOSSIBLE (5120 > 4320 sensor rows).
    // DXL2 uses RED MONSTRO VV — replace with the real anamorphic table.
    id: "panavision-dxl2-2x-ana",
    camera: "Panavision Millennium DXL2",
    mode: "8K VV 4:3 2x Anamorphic",
    width: 5760,
    height: 4320,
    squeeze: 2,
    sensorWidthMm: 40.96,
    sensorHeightMm: 21.60,
    usedSensorWidthMm: 28.80,
    usedSensorHeightMm: 21.60,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
    notes:
      "DXL2 uses MONSTRO VV sensor — same anamorphic crops as RED MONSTRO/V-Raptor VV.",
  },
  {
    id: "panavision-dxl2-13x-ana",
    camera: "Panavision Millennium DXL2",
    mode: "8K VV 17:9 1.3x Anamorphic",
    width: 8192,
    height: 4320,
    squeeze: 1.3,
    sensorWidthMm: 40.96,
    sensorHeightMm: 21.60,
    usedSensorWidthMm: 40.96,
    usedSensorHeightMm: 21.60,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
  },

  // FLAT / SCOPE reference plates (exact aspect captures for demo)
  {
    id: "flat-185-4k",
    camera: "Reference Plate",
    mode: "1.85:1 Flat 4K",
    width: 3996,
    height: 2160,
    squeeze: 1,
    notes: "Exact 1.85:1 capture — useful for demoing flat-in-16:9 letterbox.",
  },
  {
    id: "scope-239-4k",
    camera: "Reference Plate",
    mode: "2.39:1 Scope 4K",
    width: 4096,
    height: 1716,
    squeeze: 1,
    notes: "Exact 2.39:1 capture — useful for demoing scope-in-16:9 letterbox.",
  },

  // VERTICAL / PORTRAIT (phone & rotated cinema rigs)
  {
    id: "iphone-prores-vert",
    camera: "iPhone 15 Pro",
    mode: "4K ProRes Vertical 9:16",
    width: 2160,
    height: 3840,
    squeeze: 1,
    sensorWidthMm: 5.7,
    sensorHeightMm: 7.6,
    rotated: true,
    colorSpace: "Apple Log / P3",
    oetf: "Apple Log",
  },
  {
    id: "alexa35-rotated-23",
    camera: "ARRI ALEXA 35 (rotated)",
    mode: "4.4K Vertical 2:3",
    width: 2502,
    height: 4448,
    squeeze: 1,
    sensorWidthMm: 15.20,
    sensorHeightMm: 27.02,
    rotated: true,
    colorSpace: "ARRI Wide Gamut 4",
    oetf: "LogC4",
    notes: "Camera rotated 90° for native vertical capture.",
  },
  {
    id: "venice2-rotated-916",
    camera: "Sony VENICE 2 (rotated)",
    mode: "8.6K Vertical 9:16",
    width: 4860,
    height: 8640,
    squeeze: 1,
    sensorWidthMm: 24.00,
    sensorHeightMm: 35.90,
    rotated: true,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },

  // ============ Added libraries (v1.9.18) ============
  // ARRI ALEXA Mini (classic, ALEV III Super 35 — 28.25 × 18.17 mm)
  {
    id: "alexa-mini-34-og",
    camera: "ARRI ALEXA Mini",
    mode: "3.4K 3:2 Open Gate",
    width: 3424,
    height: 2202,
    squeeze: 1,
    sensorWidthMm: 28.25,
    sensorHeightMm: 18.17,
    maxFps: 30, // 3.4K Open Gate is ARRIRAW-only, capped at 30 fps (ARRI tech data)
    colorSpace: "ARRI Wide Gamut 3",
    oetf: "LogC3",
  },
  {
    id: "alexa-mini-28-43-ana",
    camera: "ARRI ALEXA Mini",
    mode: "2.8K 4:3 2x Anamorphic",
    width: 2880,
    height: 2160,
    squeeze: 2,
    sensorWidthMm: 28.25,
    sensorHeightMm: 18.17,
    usedSensorWidthMm: 23.76,
    usedSensorHeightMm: 17.82, // 2160 rows × 8.251µm pitch (4:3 photosite area)
    maxFps: 50,
    colorSpace: "ARRI Wide Gamut 3",
    oetf: "LogC3",
  },
  // Sony VENICE (1) — full-frame 6K (36.2 × 24.1 mm)
  {
    id: "venice1-6k-og",
    camera: "Sony VENICE",
    mode: "6K 3:2 Full-Frame Open Gate",
    width: 6048,
    height: 4032,
    squeeze: 1,
    sensorWidthMm: 36.2,
    sensorHeightMm: 24.1,
    maxFps: 30,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  {
    id: "venice1-4k-17",
    camera: "Sony VENICE",
    mode: "4K 17:9 Super35",
    width: 4096,
    height: 2160,
    squeeze: 1,
    sensorWidthMm: 24.30,
    sensorHeightMm: 12.80,
    maxFps: 110,
    colorSpace: "S-Gamut3.Cine",
    oetf: "S-Log3",
  },
  // RED KOMODO (original) — Super 35 6K (27.03 × 14.26 mm)
  {
    id: "komodo-6k-17",
    camera: "RED KOMODO",
    mode: "6K 17:9 Super35",
    width: 6144,
    height: 3240,
    squeeze: 1,
    sensorWidthMm: 27.03,
    sensorHeightMm: 14.26,
    maxFps: 40,
    colorSpace: "REDWideGamutRGB",
    oetf: "Log3G10",
  },
  // Nikon Z9 — full-frame (FX) 8.3K N-RAW (16:9 video area 35.9 × 20.2 mm)
  {
    id: "nikon-z9-83k",
    camera: "Nikon Z9",
    mode: "8.3K 16:9 N-RAW (FX)",
    width: 8256,
    height: 4644,
    squeeze: 1,
    sensorWidthMm: 35.9,
    sensorHeightMm: 20.2,
    maxFps: 60,
  },
  // Fujifilm GFX100 II — medium format (16:9 video area 43.8 × 24.6 mm)
  {
    id: "gfx100ii-8k",
    camera: "Fujifilm GFX100 II",
    mode: "8K 16:9 (Medium Format)",
    width: 7680,
    height: 4320,
    squeeze: 1,
    sensorWidthMm: 43.8,
    sensorHeightMm: 24.6,
    maxFps: 30,
  },
  // Phantom Flex4K — Super 35 high-speed (27.6 × 15.5 mm)
  {
    id: "phantom-flex4k",
    camera: "Phantom Flex4K",
    mode: "4K 16:9 High-Speed", // 4096×2304 = 16:9; 938 fps at full readout (1000 fps needs the shorter 4096×2160)
    width: 4096,
    height: 2304,
    squeeze: 1,
    sensorWidthMm: 27.6,
    sensorHeightMm: 15.5,
    maxFps: 938,
  },
  // Canon EOS C700 FF — full-frame 5.9K (38.1 × 20.1 mm)
  {
    id: "c700ff-59k",
    camera: "Canon EOS C700 FF",
    mode: "5.9K Full Frame",
    width: 5952,
    height: 3140,
    squeeze: 1,
    sensorWidthMm: 38.1,
    sensorHeightMm: 20.1,
    maxFps: 60,
    colorSpace: "Cinema Gamut",
    oetf: "Canon Log 2",
  },
];

// --- Delivery containers ----------------------------------------------------
// HDR variants and audio targets are based on actual streaming-platform specs:
//   Netflix Primary  : Dolby Vision P8.1 + HDR10 + SDR. -27 LUFS, -2 dBTP, 5.1 / 7.1.4 Atmos
//   Amazon NAM       : HDR10 + SDR. -24 LUFS, -2 dBTP, 5.1 / 7.1.4 Atmos
//   Broadcast (TVNZ/BCAP) : SDR Rec.709. -24 LUFS, -2 dBTP, 5.1 stereo fold
//   DCP              : SDR Rec.709 / XYZ. -31 LUFS reference, 5.1 / 7.1
//   Social (YT/TT/IG): SDR + HDR10 (where supported). -14 LUFS, -1 dBTP, 2.0
const NETFLIX_HDR: HdrVariant[] = ["Dolby Vision P8.1", "HDR10", "SDR"];
const HDR_STREAMING: HdrVariant[] = ["Dolby Vision P8.1", "HDR10", "HLG", "SDR"];
const HDR_BROADCAST: HdrVariant[] = ["HDR10", "HLG", "SDR"];
const SDR_ONLY: HdrVariant[] = ["SDR"];

const STREAMING_AUDIO: DeliveryAudio = {
  channels: "5.1",
  lufs: -27,
  truePeakDb: -2,
  notes: "Netflix Primary spec — extends to 7.1.4 Atmos for premium tracks.",
};
const STREAMING_AUDIO_VARIANTS: AudioChannelConfig[] = ["5.1", "7.1.4 Atmos", "2.0"];
const BROADCAST_AUDIO: DeliveryAudio = {
  channels: "5.1",
  lufs: -24,
  truePeakDb: -2,
  notes: "ATSC A/85 / EBU R128 broadcast loudness (BCAP, ABC, BBC).",
};
const BROADCAST_AUDIO_VARIANTS: AudioChannelConfig[] = ["5.1", "2.0"];
const DCI_AUDIO: DeliveryAudio = {
  channels: "5.1",
  lufs: -31,
  truePeakDb: -3,
  notes: "DCI reference: 85 dB SPL @ -20 dBFS, leader -31 LUFS.",
};
const DCI_AUDIO_VARIANTS: AudioChannelConfig[] = ["5.1", "7.1", "7.1.4 Atmos"];
const SOCIAL_AUDIO: DeliveryAudio = {
  channels: "2.0",
  lufs: -14,
  truePeakDb: -1,
  notes: "YouTube / TikTok / Spotify normalisation target.",
};

export const TARGETS: TargetContainer[] = [
  // Broadcast
  { id: "hd-1080", group: "Broadcast", name: "HD 1080p", width: 1920, height: 1080, ratioLabel: "16:9", hdrVariants: SDR_ONLY, audio: BROADCAST_AUDIO, audioVariants: BROADCAST_AUDIO_VARIANTS },
  { id: "uhd-4k", group: "Broadcast", name: "UHD 4K", width: 3840, height: 2160, ratioLabel: "16:9", hdrVariants: HDR_STREAMING, audio: STREAMING_AUDIO, audioVariants: STREAMING_AUDIO_VARIANTS },

  // Cinema
  // 2:1 (Univisium) active picture area letterboxed inside a 16:9 UHD/HD container —
  // a streaming/broadcast master (Netflix-style), NOT a theatrical DCP. Lives in Broadcast.
  { id: "uhd-2to1-in-169", group: "Broadcast", name: "2:1 in UHD 16:9", width: 3840, height: 2160, ratioLabel: "2:1 ⊂ 16:9", activeWidth: 3840, activeHeight: 1920, hdrVariants: NETFLIX_HDR, audio: STREAMING_AUDIO, audioVariants: STREAMING_AUDIO_VARIANTS },
  { id: "hd-2to1-in-169", group: "Broadcast", name: "2:1 in HD 16:9", width: 1920, height: 1080, ratioLabel: "2:1 ⊂ 16:9", activeWidth: 1920, activeHeight: 960, hdrVariants: NETFLIX_HDR, audio: STREAMING_AUDIO, audioVariants: STREAMING_AUDIO_VARIANTS },
  { id: "dci-2k-flat", group: "Cinema", name: "DCI 2K Flat", width: 1998, height: 1080, ratioLabel: "1.85:1", hdrVariants: SDR_ONLY, audio: DCI_AUDIO, audioVariants: DCI_AUDIO_VARIANTS },
  { id: "dci-2k-scope", group: "Cinema", name: "DCI 2K Scope", width: 2048, height: 858, ratioLabel: "2.39:1", hdrVariants: SDR_ONLY, audio: DCI_AUDIO, audioVariants: DCI_AUDIO_VARIANTS },
  { id: "dci-2k-full", group: "Cinema", name: "DCI 2K Full", width: 2048, height: 1080, ratioLabel: "1.90:1", hdrVariants: SDR_ONLY, audio: DCI_AUDIO, audioVariants: DCI_AUDIO_VARIANTS },
  { id: "dci-4k-flat", group: "Cinema", name: "DCI 4K Flat", width: 3996, height: 2160, ratioLabel: "1.85:1", hdrVariants: SDR_ONLY, audio: DCI_AUDIO, audioVariants: DCI_AUDIO_VARIANTS },
  { id: "dci-4k-scope", group: "Cinema", name: "DCI 4K Scope", width: 4096, height: 1716, ratioLabel: "2.39:1", hdrVariants: SDR_ONLY, audio: DCI_AUDIO, audioVariants: DCI_AUDIO_VARIANTS },
  { id: "dci-4k-full", group: "Cinema", name: "DCI 4K Full", width: 4096, height: 2160, ratioLabel: "1.90:1", hdrVariants: SDR_ONLY, audio: DCI_AUDIO, audioVariants: DCI_AUDIO_VARIANTS },

  // Mastering — required for delivery to Netflix / Amazon / Apple / Disney+
  { id: "imf-uhd-j2k", group: "Mastering", name: "IMF UHD (J2K MXF)", width: 3840, height: 2160, ratioLabel: "16:9", hdrVariants: HDR_STREAMING, audio: STREAMING_AUDIO, audioVariants: STREAMING_AUDIO_VARIANTS },
  { id: "imf-4k-j2k", group: "Mastering", name: "IMF 4K DCI (J2K MXF)", width: 4096, height: 2160, ratioLabel: "1.90:1", hdrVariants: HDR_STREAMING, audio: STREAMING_AUDIO, audioVariants: STREAMING_AUDIO_VARIANTS },
  { id: "imf-hd-j2k", group: "Mastering", name: "IMF HD (J2K MXF)", width: 1920, height: 1080, ratioLabel: "16:9", hdrVariants: HDR_STREAMING, audio: STREAMING_AUDIO, audioVariants: STREAMING_AUDIO_VARIANTS },

  // Social
  { id: "social-vert", group: "Social", name: "Vertical (Reels / TikTok)", width: 1080, height: 1920, ratioLabel: "9:16", hdrVariants: SDR_ONLY, audio: SOCIAL_AUDIO },
  { id: "social-square", group: "Social", name: "Square (Instagram Feed)", width: 1080, height: 1080, ratioLabel: "1:1", hdrVariants: SDR_ONLY, audio: SOCIAL_AUDIO },
  { id: "social-portrait", group: "Social", name: "Portrait (Instagram 4:5)", width: 1080, height: 1350, ratioLabel: "4:5", hdrVariants: SDR_ONLY, audio: SOCIAL_AUDIO },
  { id: "social-yt-short", group: "Social", name: "YouTube Short", width: 1080, height: 1920, ratioLabel: "9:16", hdrVariants: SDR_ONLY, audio: SOCIAL_AUDIO },
];

/** Peak luminance (nits) per HDR variant for spec sheet. */
export function hdrPeakNits(v: HdrVariant): number {
  switch (v) {
    case "Dolby Vision P8.1": return 4000;
    case "HDR10+":            return 4000;
    case "HDR10":             return 1000;
    case "HLG":               return 1000;
    case "SDR":               return 100;
  }
}

// --- Codec bitrate library --------------------------------------------------
// Bitrates are in megabits per second (Mbps) at the listed reference resolution
// & frame rate. Where a codec scales linearly with pixels × fps, a `bppx`
// (bits per pixel) value is used so bitrate = bppx × W × H × fps.
//
// IMPORTANT (v1.4 §B.7 fix): All `bppx` values are TRUE bits-per-pixel.
// Earlier the ARRIRAW bppx was set to 12/8 = 1.5 (BYTES per pixel) with the
// rest of the pipeline treating the result as Mbps, producing an 8× under-
// statement. ARRIRAW uncompressed is 12 bits per pixel ⇒ bppx = 12.0.
//
// Sources: ARRI, RED, Sony, Blackmagic, Apple, Canon official codec docs.

export type CodecCategory =
  | "RAW"
  | "ProRes"
  | "DNxHR"
  | "XAVC"
  | "BRAW"
  | "AVC/HEVC"
  | "Cinema RAW"
  | "REDCODE";

export type Codec = {
  id: string;
  vendor: string;
  family: CodecCategory;
  name: string;
  /** True bits per pixel per frame. If set, Mbps = bppx × W × H × fps / 1e6. */
  bppx?: number;
  /** Fixed Mbps rate, independent of resolution (e.g. XAVC-I 4K class). */
  fixedMbps?: number;
  /** Reference resolution & fps that fixedMbps was measured at. */
  refRes?: { width: number; height: number; fps: number };
  /** Discrete published rate table (resolution-class → fps → Mbps), used for
   *  ProRes etc. where Apple's published numbers are NOT linear in fps. */
  rateTable?: ProResRateTable;
  /** Free-text bitrate description shown to the user. */
  rateLabel: string;
  notes?: string;
};

/** ProRes-style rate table: by resolution class then frame rate.
 *  Resolution classes are matched on width nearest one of:
 *    1280 (HD), 1920 (HD), 2048 (DCI 2K), 3840 (UHD), 4096 (DCI 4K), 8192 (8K).
 *  Frame rate is matched on integer-rounded value with closest-fps fallback. */
export type ProResRateTable = Record<string, Record<number, number>>;

// Apple ProRes published rates (Apple "ProRes White Paper", April 2023).
// Mbps at the listed (resolution × integer-fps).
const PRORES_4444XQ_TABLE: ProResRateTable = {
  "1920": { 24: 500, 25: 521, 30: 626, 50: 1042, 60: 1253 },
  "3840": { 24: 1857, 25: 1934, 30: 2321, 50: 3868, 60: 4642 },
  "4096": { 24: 1980, 25: 2062, 30: 2475, 50: 4124, 60: 4949 },
  "8192": { 24: 7920, 25: 8250, 30: 9900 },
};
const PRORES_4444_TABLE: ProResRateTable = {
  "1920": { 24: 330, 25: 344, 30: 413, 50: 688, 60: 826 },
  "3840": { 24: 1244, 25: 1296, 30: 1555, 50: 2592, 60: 3110 },
  "4096": { 24: 1326, 25: 1381, 30: 1657, 50: 2762, 60: 3315 },
  "8192": { 24: 5305, 25: 5527, 30: 6630 },
};
const PRORES_422HQ_TABLE: ProResRateTable = {
  "1920": { 24: 220, 25: 229, 30: 275, 50: 458, 60: 550 },
  "3840": { 24: 707, 25: 737, 30: 884, 50: 1473, 60: 1768 },
  "4096": { 24: 754, 25: 786, 30: 942, 50: 1571, 60: 1885 },
  "8192": { 24: 3015, 25: 3140, 30: 3768 },
};
const PRORES_422_TABLE: ProResRateTable = {
  "1920": { 24: 147, 25: 154, 30: 184, 50: 307, 60: 369 },
  "3840": { 24: 471, 25: 491, 30: 589, 50: 982, 60: 1179 },
  "4096": { 24: 503, 25: 524, 30: 628, 50: 1047, 60: 1257 },
  "8192": { 24: 2010, 25: 2095, 30: 2515 },
};
const PRORES_422LT_TABLE: ProResRateTable = {
  "1920": { 24: 102, 25: 107, 30: 128, 50: 213, 60: 256 },
  "3840": { 24: 328, 25: 342, 30: 410, 50: 684, 60: 821 },
  "4096": { 24: 350, 25: 365, 30: 437, 50: 729, 60: 875 },
};
const PRORES_422PROXY_TABLE: ProResRateTable = {
  "1920": { 24: 45, 25: 47, 30: 57, 50: 94, 60: 113 },
  "3840": { 24: 145, 25: 152, 30: 182, 50: 303, 60: 364 },
  "4096": { 24: 155, 25: 161, 30: 194, 50: 323, 60: 388 },
};

export const CODECS: Codec[] = [
  // -------- ARRI --------
  {
    id: "arriraw-og",
    vendor: "ARRI",
    family: "RAW",
    name: "ARRIRAW (.ari) — Uncompressed",
    bppx: 12, // 12-bit log uncompressed = 12 bits per pixel.
    rateLabel: "12-bit uncompressed · ~4.2 Gbps @ 4.6K 24p · ~1.85 TB/hr",
  },
  {
    id: "arriraw-hde",
    vendor: "ARRI",
    family: "RAW",
    name: "ARRIRAW HDE (lossless)",
    // HDE typically achieves ~3.5–4× compression on log-encoded ARRIRAW.
    // 12 bpp / 4 ≈ 3.0 bpp.
    bppx: 3.0,
    rateLabel: "Lossless compressed · ~1.05 Gbps @ 4.6K 24p · ~470 GB/hr",
    notes: "ARRIRAW High-Density Encoding. Bit-exact decode, ~3.5–4× compression.",
  },
  {
    id: "arri-prores-4444xq",
    vendor: "ARRI",
    family: "ProRes",
    name: "ProRes 4444 XQ",
    rateTable: PRORES_4444XQ_TABLE,
    rateLabel: "Apple table · 500 Mbps @ HD24 / 1.86 Gbps @ UHD24",
  },
  {
    id: "arri-prores-4444",
    vendor: "ARRI",
    family: "ProRes",
    name: "ProRes 4444",
    rateTable: PRORES_4444_TABLE,
    rateLabel: "Apple table · 330 Mbps @ HD24 / 1.24 Gbps @ UHD24",
  },
  {
    id: "arri-prores-422hq",
    vendor: "ARRI",
    family: "ProRes",
    name: "ProRes 422 HQ",
    rateTable: PRORES_422HQ_TABLE,
    rateLabel: "Apple table · 220 Mbps @ HD24 / 707 Mbps @ UHD24",
  },
  {
    id: "arri-prores-422",
    vendor: "ARRI",
    family: "ProRes",
    name: "ProRes 422",
    rateTable: PRORES_422_TABLE,
    rateLabel: "Apple table · 147 Mbps @ HD24 / 471 Mbps @ UHD24",
  },
  {
    id: "arri-prores-422lt",
    vendor: "ARRI",
    family: "ProRes",
    name: "ProRes 422 LT",
    rateTable: PRORES_422LT_TABLE,
    rateLabel: "Apple table · 102 Mbps @ HD24 / 328 Mbps @ UHD24",
  },
  {
    id: "arri-prores-422proxy",
    vendor: "ARRI",
    family: "ProRes",
    name: "ProRes 422 Proxy",
    rateTable: PRORES_422PROXY_TABLE,
    rateLabel: "Apple table · 45 Mbps @ HD24 / 145 Mbps @ UHD24",
  },

  // -------- RED REDCODE --------
  // REDCODE is variable-quality; bppx values calibrated so 8K 17:9 24p HQ ≈ 2.25 Gbps.
  {
    id: "red-r3d-hq",
    vendor: "RED",
    family: "REDCODE",
    name: "REDCODE RAW HQ",
    bppx: 2.6,
    rateLabel: "Visually lossless · ~2.25 Gbps @ 8K 17:9 24p · ~1.0 TB/hr",
  },
  {
    id: "red-r3d-mq",
    vendor: "RED",
    family: "REDCODE",
    name: "REDCODE RAW MQ",
    bppx: 1.85,
    rateLabel: "Medium quality · ~1.6 Gbps @ 8K 17:9 24p",
  },
  {
    id: "red-r3d-lq",
    vendor: "RED",
    family: "REDCODE",
    name: "REDCODE RAW LQ",
    bppx: 1.3,
    rateLabel: "Low quality · ~1.1 Gbps @ 8K 17:9 24p",
  },

  // -------- SONY --------
  // X-OCN bppx calibrated to Sony's published VENICE 2 8.6K 17:9 (8640×4556) 24p
  // figure: LT = 1,706 Mbps (verified). ST/XT scaled from Sony's record-time ratio.
  // bppx = rate·1e6 / (W·H·fps): LT 1.81, ST 3.07, XT 4.55.
  {
    id: "sony-x-ocn-xt",
    vendor: "Sony",
    family: "RAW",
    name: "X-OCN XT (VENICE)",
    bppx: 4.55,
    rateLabel: "16-bit linear, near-lossless · ~4.29 Gbps @ 8.6K 17:9 24p · ~1.93 TB/hr",
  },
  {
    id: "sony-x-ocn-st",
    vendor: "Sony",
    family: "RAW",
    name: "X-OCN ST (VENICE)",
    bppx: 3.07,
    rateLabel: "16-bit linear (standard) · ~2.90 Gbps @ 8.6K 17:9 24p · ~1.30 TB/hr",
  },
  {
    id: "sony-x-ocn-lt",
    vendor: "Sony",
    family: "RAW",
    name: "X-OCN LT (VENICE)",
    bppx: 1.81,
    rateLabel: "16-bit linear (light) · 1.71 Gbps @ 8.6K 17:9 24p · ~0.77 TB/hr",
  },
  {
    id: "sony-xavc-i-4k",
    vendor: "Sony",
    family: "XAVC",
    name: "XAVC-I Class 300 (4K)",
    fixedMbps: 300,
    refRes: { width: 3840, height: 2160, fps: 30 },
    rateLabel: "300 Mbps Intra (UHD 30p)",
  },
  {
    id: "sony-xavc-i-hd",
    vendor: "Sony",
    family: "XAVC",
    name: "XAVC-I Class 100 (HD)",
    fixedMbps: 100,
    refRes: { width: 1920, height: 1080, fps: 30 },
    rateLabel: "100 Mbps Intra (HD 30p)",
  },
  {
    id: "sony-xavc-l-4k50",
    vendor: "Sony",
    family: "XAVC",
    name: "XAVC-L 50 Mbps (4K)",
    fixedMbps: 50,
    refRes: { width: 3840, height: 2160, fps: 30 },
    rateLabel: "50 Mbps LongGOP (UHD 30p)",
  },
  {
    id: "sony-xavc-hs-4k",
    vendor: "Sony",
    family: "AVC/HEVC",
    name: "XAVC HS 4K 200 Mbps",
    fixedMbps: 200,
    refRes: { width: 3840, height: 2160, fps: 60 },
    rateLabel: "200 Mbps HEVC LongGOP (UHD 60p)",
  },
  {
    id: "sony-xavc-l-hd50",
    vendor: "Sony",
    family: "XAVC",
    name: "XAVC-L 50 Mbps (HD)",
    fixedMbps: 50,
    refRes: { width: 1920, height: 1080, fps: 30 },
    rateLabel: "50 Mbps LongGOP (HD 30p) — common ENG mezz",
  },
  {
    id: "sony-xavc-l-hd35",
    vendor: "Sony",
    family: "XAVC",
    name: "XAVC-L 35 Mbps (HD)",
    fixedMbps: 35,
    refRes: { width: 1920, height: 1080, fps: 30 },
    rateLabel: "35 Mbps LongGOP (HD 30p)",
  },
  {
    id: "sony-xavc-l-hd25",
    vendor: "Sony",
    family: "XAVC",
    name: "XAVC-L 25 Mbps (HD)",
    fixedMbps: 25,
    refRes: { width: 1920, height: 1080, fps: 30 },
    rateLabel: "25 Mbps LongGOP (HD 30p) — proxy/low-bit",
  },
  {
    id: "sony-mpeg-hd422-50",
    vendor: "Sony",
    family: "AVC/HEVC",
    name: "MPEG HD422 50 Mbps",
    fixedMbps: 50,
    refRes: { width: 1920, height: 1080, fps: 30 },
    rateLabel: "Broadcast 50 Mbps 4:2:2 8-bit (XDCAM HD422)",
  },
  {
    id: "sony-xdcam-hd-35",
    vendor: "Sony",
    family: "AVC/HEVC",
    name: "XDCAM HD 35 Mbps",
    fixedMbps: 35,
    refRes: { width: 1920, height: 1080, fps: 30 },
    rateLabel: "MPEG-2 LongGOP 4:2:0",
  },
  {
    id: "sony-dvcam-25",
    vendor: "Sony",
    family: "AVC/HEVC",
    name: "DVCAM 25 Mbps",
    fixedMbps: 25,
    refRes: { width: 1920, height: 1080, fps: 30 },
    rateLabel: "Legacy SD/HD 25 Mbps DV-style",
  },
  // Blackmagic RAW (bppx values × 8 to fix the legacy unit error).
  {
    id: "braw-3to1",
    vendor: "Blackmagic",
    family: "BRAW",
    name: "Blackmagic RAW 3:1",
    bppx: 4.0,
    rateLabel: "3:1 constant quality · ~1.7 Gbps @ 6K 24p",
  },
  {
    id: "braw-5to1",
    vendor: "Blackmagic",
    family: "BRAW",
    name: "Blackmagic RAW 5:1",
    bppx: 2.4,
    rateLabel: "5:1 constant quality (default)",
  },
  {
    id: "braw-8to1",
    vendor: "Blackmagic",
    family: "BRAW",
    name: "Blackmagic RAW 8:1",
    bppx: 1.5,
    rateLabel: "8:1 constant quality",
  },
  {
    id: "braw-12to1",
    vendor: "Blackmagic",
    family: "BRAW",
    name: "Blackmagic RAW 12:1",
    bppx: 1.0,
    rateLabel: "12:1 constant quality",
  },

  // -------- Canon --------
  {
    id: "canon-craw-lt",
    vendor: "Canon",
    family: "Cinema RAW",
    name: "Cinema RAW Light LT",
    bppx: 2.4,
    rateLabel: "Light internal RAW (lower bitrate)",
  },
  {
    id: "canon-craw-st",
    vendor: "Canon",
    family: "Cinema RAW",
    name: "Cinema RAW Light ST",
    bppx: 3.6,
    rateLabel: "Standard internal RAW",
  },
  {
    id: "canon-craw-hq",
    vendor: "Canon",
    family: "Cinema RAW",
    name: "Cinema RAW Light HQ",
    bppx: 5.2,
    rateLabel: "High-quality internal RAW",
  },
  {
    id: "canon-xfavc-4k",
    vendor: "Canon",
    family: "XAVC",
    name: "XF-AVC 4K Intra 410",
    fixedMbps: 410,
    refRes: { width: 3840, height: 2160, fps: 30 },
    rateLabel: "410 Mbps Intra (UHD 30p)",
  },

  // -------- Apple ProRes (generic fallback) --------
  {
    id: "prores-raw-hq",
    vendor: "Apple",
    family: "ProRes",
    name: "ProRes RAW HQ",
    bppx: 4.0,
    rateLabel: "Variable RAW, near visually lossless",
  },
  {
    id: "prores-raw",
    vendor: "Apple",
    family: "ProRes",
    name: "ProRes RAW",
    bppx: 2.4,
    rateLabel: "Standard RAW",
  },

  // -------- Distribution / Mezzanine --------
  {
    id: "h264-100",
    vendor: "Generic",
    family: "AVC/HEVC",
    name: "H.264 100 Mbps (broadcast mezz)",
    fixedMbps: 100,
    refRes: { width: 3840, height: 2160, fps: 30 },
    rateLabel: "Common 4K mezzanine",
  },
  {
    id: "h265-50",
    vendor: "Generic",
    family: "AVC/HEVC",
    name: "H.265 50 Mbps (4K streaming)",
    fixedMbps: 50,
    refRes: { width: 3840, height: 2160, fps: 30 },
    rateLabel: "High-bitrate streaming",
  },

  // -------- Avid DNxHR (post / proxy) --------
  // Avid published rates @ UHD 24p; scales linearly with pixel-rate.
  {
    id: "dnxhr-lb",
    vendor: "Avid",
    family: "DNxHR",
    name: "DNxHR LB (Low Bandwidth)",
    fixedMbps: 36,
    refRes: { width: 3840, height: 2160, fps: 24 },
    rateLabel: "Editorial proxy · 8-bit 4:2:2 · 36 Mbps @ UHD 24p",
  },
  {
    id: "dnxhr-sq",
    vendor: "Avid",
    family: "DNxHR",
    name: "DNxHR SQ (Standard Quality)",
    fixedMbps: 145,
    refRes: { width: 3840, height: 2160, fps: 24 },
    rateLabel: "Offline edit · 8-bit 4:2:2 · 145 Mbps @ UHD 24p",
  },
  {
    id: "dnxhr-hq",
    vendor: "Avid",
    family: "DNxHR",
    name: "DNxHR HQ (High Quality)",
    fixedMbps: 220,
    refRes: { width: 3840, height: 2160, fps: 24 },
    rateLabel: "Mezzanine · 8-bit 4:2:2 · 220 Mbps @ UHD 24p",
  },
  {
    id: "dnxhr-hqx",
    vendor: "Avid",
    family: "DNxHR",
    name: "DNxHR HQX (High Quality 12-bit)",
    fixedMbps: 666, // Avid KB: 83.26 MB/s @ UHD 23.976p
    refRes: { width: 3840, height: 2160, fps: 24 },
    rateLabel: "HDR-grade mezzanine · 12-bit 4:2:2 · ~666 Mbps @ UHD 24p",
  },

  // -------- H.264 dailies (viewing copies) --------
  {
    id: "h264-dailies-hd",
    vendor: "Generic",
    family: "AVC/HEVC",
    name: "H.264 Dailies HD (15 Mbps)",
    fixedMbps: 15,
    refRes: { width: 1920, height: 1080, fps: 24 },
    rateLabel: "iPad / phone viewing copies · HD 1080p · ~15 Mbps",
  },
  {
    id: "h264-dailies-uhd",
    vendor: "Generic",
    family: "AVC/HEVC",
    name: "H.264 Dailies UHD (30 Mbps)",
    fixedMbps: 30,
    refRes: { width: 3840, height: 2160, fps: 24 },
    rateLabel: "Director / DP viewing copies · UHD · ~30 Mbps",
  },
];

// --- Proxy / Dailies preset list -------------------------------------------
// Codec IDs commonly transcoded as offline proxies & dailies viewing copies.
// Bitrates are computed at the DELIVERY target resolution (proxies usually
// match delivery aspect, not the camera sensor pixel count).
export const PROXY_CODEC_IDS: { id: string; resolutionTier: "delivery" | "hd" }[] = [
  { id: "arri-prores-422proxy", resolutionTier: "delivery" },
  { id: "arri-prores-422lt",    resolutionTier: "delivery" },
  { id: "arri-prores-422",      resolutionTier: "delivery" },
  { id: "arri-prores-422hq",    resolutionTier: "delivery" },
  { id: "dnxhr-lb",             resolutionTier: "delivery" },
  { id: "dnxhr-sq",             resolutionTier: "delivery" },
  { id: "dnxhr-hq",             resolutionTier: "delivery" },
  { id: "dnxhr-hqx",            resolutionTier: "delivery" },
];

// --- Derived helpers --------------------------------------------------------

/** Source displayed (desqueezed) dimensions in image-space. */
export function sourceDisplayed(src: SourceFormat) {
  return {
    width: src.width * src.squeeze,
    height: src.height,
    aspect: (src.width * src.squeeze) / src.height,
  };
}

export function targetAspect(t: TargetContainer) {
  // If an active picture area is defined (e.g. 2:1 inside 16:9), the deliverable
  // aspect is the ACTIVE aspect — extraction targets that.
  if (t.activeWidth && t.activeHeight) return t.activeWidth / t.activeHeight;
  return t.width / t.height;
}

/** Storage frame aspect (the on-disk container ratio). */
export function targetStorageAspect(t: TargetContainer) {
  return t.width / t.height;
}

/** Reduce a ratio to a clean label like "16:9", "3:2", "2.39:1". */
export function aspectRatioLabel(width: number, height: number): string {
  const ratio = width / height;
  // Common cinema/broadcast ratios first (tolerance ±0.012)
  const known: { r: number; label: string }[] = [
    { r: 16 / 9, label: "16:9" },
    { r: 9 / 16, label: "9:16" },
    { r: 4 / 3, label: "4:3" },
    { r: 3 / 4, label: "3:4" },
    { r: 3 / 2, label: "3:2" },
    { r: 2 / 3, label: "2:3" },
    { r: 17 / 9, label: "17:9" },
    { r: 1.85, label: "1.85:1" },
    { r: 1.9, label: "1.90:1" },
    { r: 2.0, label: "2:1" },
    { r: 2.39, label: "2.39:1" },
    { r: 2.40, label: "2.40:1" },
    { r: 2.35, label: "2.35:1" },
    { r: 1, label: "1:1" },
    { r: 6 / 5, label: "6:5" },
    { r: 4 / 5, label: "4:5" },
    { r: 21 / 9, label: "21:9" },
  ];
  for (const k of known) if (Math.abs(ratio - k.r) < 0.012) return k.label;
  return `${ratio.toFixed(2)}:1`;
}

export type FitMode = "fit" | "fill";

/**
 * Compute how the target container is extracted from the source frame.
 * - `fit` (contain): target fits entirely INSIDE source.
 * - `fill` (cover): target COVERS source, cropping the longer axis.
 */
export function computeExtraction(
  src: SourceFormat,
  tgt: TargetContainer,
  mode: FitMode = "fit",
) {
  const s = sourceDisplayed(src);
  const tAsp = targetAspect(tgt);
  let extractW: number;
  let extractH: number;

  // Both modes keep the TARGET aspect ratio for the final frame.
  if (mode === "fill") {
    // COVER — largest target-aspect rect that fits INSIDE the sensor. Crops the
    // sensor on one axis (loses edges); no bars.
    if (tAsp > s.aspect) {
      extractW = s.width;
      extractH = extractW / tAsp;
    } else {
      extractH = s.height;
      extractW = extractH * tAsp;
    }
  } else {
    // CONTAIN — smallest target-aspect rect that ENCLOSES the whole sensor.
    // Nothing is cropped; the delivery gains letterbox/pillarbox bars instead.
    if (tAsp > s.aspect) {
      extractH = s.height;
      extractW = extractH * tAsp; // wider than sensor → pillarbox L/R
    } else {
      extractW = s.width;
      extractH = extractW / tAsp; // taller than sensor → letterbox T/B
    }
  }

  const cropPctH = Math.max(0, 1 - extractW / s.width);
  const cropPctV = Math.max(0, 1 - extractH / s.height);
  const usedArea =
    (Math.min(extractW, s.width) * Math.min(extractH, s.height)) /
    (s.width * s.height);
  const deliverableW = tgt.activeWidth ?? tgt.width;
  // Extract is the target aspect in both modes, so width- and height-scale match.
  const scale = deliverableW / extractW;
  return {
    extractW,
    extractH,
    cropPctH,
    cropPctV,
    usedArea,
    scale,
    mode,
    sourceDisplayedW: s.width,
    sourceDisplayedH: s.height,
    sourceAspect: s.aspect,
    targetAspect: tAsp,
  };
}

export function formatNumber(n: number, digits = 0) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// --- File size estimation ---------------------------------------------------

/** Look up the closest published rate from a rate table for given (W, H, fps). */
function lookupProResRate(table: ProResRateTable, width: number, height: number, fps: number): number | null {
  // Pick the resolution row whose width is closest to requested width.
  const widths = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (widths.length === 0) return null;
  let bestW = widths[0];
  let bestDist = Math.abs(widths[0] - width);
  for (const w of widths) {
    const d = Math.abs(w - width);
    if (d < bestDist) { bestDist = d; bestW = w; }
  }
  const row = table[String(bestW)];
  // Pick the closest published fps in that row.
  const fpsKeys = Object.keys(row).map(Number).sort((a, b) => a - b);
  if (fpsKeys.length === 0) return null;
  let bestF = fpsKeys[0];
  let bestFD = Math.abs(fpsKeys[0] - fps);
  for (const f of fpsKeys) {
    const d = Math.abs(f - fps);
    if (d < bestFD) { bestFD = d; bestF = f; }
  }
  // Linear scale from published reference up to the ACTUAL pixel rate, so tall /
  // anamorphic / out-of-table requests scale on real W×H (not an assumed 16:9).
  const refRate = row[bestF];
  const refPx = bestW * (bestW * 9 / 16); // published rows are 16:9 reference frames
  const refPxRate = refPx * bestF;
  const askPxRate = width * height * fps;
  if (refPxRate <= 0) return refRate;
  return refRate * (askPxRate / refPxRate);
}

/**
 * Estimate codec bitrate in Mbps for a given resolution & fps.
 * - Rate tables (ProRes) take precedence over linear models.
 * - bppx scales linearly with pixel-rate.
 * - fixedMbps with ref scales linearly with (W·H·fps) ratio.
 */
export function codecMbps(
  codec: Codec,
  width: number,
  height: number,
  fps: number,
): number {
  if (codec.rateTable) {
    const r = lookupProResRate(codec.rateTable, width, height, fps);
    if (r != null) return r;
  }
  if (codec.bppx) {
    return (codec.bppx * width * height * fps) / 1_000_000;
  }
  if (codec.fixedMbps && codec.refRes) {
    const refPxRate =
      codec.refRes.width * codec.refRes.height * codec.refRes.fps;
    const pxRate = width * height * fps;
    return codec.fixedMbps * (pxRate / refPxRate);
  }
  return codec.fixedMbps ?? 0;
}

/** Estimate file size in gigabytes for a clip of `seconds` length.
 *  Decimal GB (1 GB = 1e9 bytes) to match Finder / Hedge / Silverstack and the
 *  way card capacities are marketed. */
export function estimateFileSizeGB(mbps: number, seconds: number): number {
  // Mbps → MB/s = /8; × seconds = MB; / 1000 = GB (decimal)
  return (mbps * seconds) / 8 / 1000;
}

/** Format a decimal-GB value into a human-readable string (decimal units). */
export function formatSize(gb: number): string {
  if (gb < 0.001) return `${(gb * 1000 * 1000).toFixed(0)} KB`;
  if (gb < 1) return `${(gb * 1000).toFixed(1)} MB`;
  if (gb < 1000) return `${gb.toFixed(2)} GB`;
  return `${(gb / 1000).toFixed(2)} TB`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// --- Camera → native codec mapping -----------------------------------------
// Returns the codecs that camera bodies actually record natively.
export function nativeCodecsForCamera(cameraName: string): Codec[] {
  const c = cameraName.toLowerCase();
  const ids = (() => {
    if (c.includes("alexa") || c.includes("amira") || c.includes("arri")) {
      return ["arriraw-og", "arriraw-hde", "arri-prores-4444xq", "arri-prores-4444", "arri-prores-422hq", "arri-prores-422", "arri-prores-422lt", "arri-prores-422proxy"];
    }
    if (c.includes("v-raptor") || c.includes("monstro") || c.includes("komodo") || c.startsWith("red ") || c === "red") {
      return ["red-r3d-hq", "red-r3d-mq", "red-r3d-lq"];
    }
    if (c.includes("venice")) {
      return ["sony-x-ocn-xt", "sony-x-ocn-st", "sony-x-ocn-lt", "sony-xavc-i-4k", "sony-xavc-i-hd"];
    }
    if (c.includes("burano")) {
      return ["sony-x-ocn-st", "sony-x-ocn-lt", "sony-xavc-i-4k", "sony-xavc-i-hd"];
    }
    if (c.includes("fx9") || c.includes("fx6") || c.includes("fx3") || c.includes("α7s") || c.includes("a7s")) {
      return ["sony-xavc-i-4k", "sony-xavc-l-4k50", "sony-xavc-hs-4k", "sony-xavc-i-hd", "sony-xavc-l-hd50"];
    }
    if (c.includes("pxw-fs7")) {
      return ["sony-xavc-i-4k", "sony-xavc-l-4k50", "sony-xavc-i-hd", "sony-xavc-l-hd50", "sony-xavc-l-hd35"];
    }
    if (c.includes("pxw-z750")) {
      return ["sony-xavc-i-hd", "sony-mpeg-hd422-50", "sony-xdcam-hd-35"];
    }
    if (c.includes("pxw-z280")) {
      return ["sony-xavc-l-hd50", "sony-xavc-l-hd35", "sony-xavc-l-hd25", "sony-mpeg-hd422-50"];
    }
    if (c.includes("ursa") || c.includes("pocket") || c.includes("blackmagic")) {
      return ["braw-3to1", "braw-5to1", "braw-8to1", "braw-12to1"];
    }
    if (c.includes("c500") || c.includes("c400") || c.includes("c300") || c.includes("c70") || c.includes("r5 c") || c.includes("r5c") || c.includes("canon")) {
      return ["canon-craw-hq", "canon-craw-st", "canon-craw-lt", "canon-xfavc-4k"];
    }
    if (c.includes("iphone")) {
      return ["prores-raw-hq", "prores-raw"];
    }
    if (c.includes("panavision")) {
      return ["red-r3d-hq", "red-r3d-mq", "red-r3d-lq"];
    }
    return ["arri-prores-422hq", "h264-100", "h265-50"];
  })();
  return ids
    .map((id) => CODECS.find((c) => c.id === id))
    .filter((c): c is Codec => Boolean(c));
}

/** Format aspect ratio as "1.78:1" decimal label — pairs with named ratio. */
export function aspectDecimalLabel(width: number, height: number): string {
  return `${(width / height).toFixed(2)}:1`;
}

// --- Lens image-circle library ---------------------------------------------
// Each entry is the manufacturer's stated image-circle diameter (mm).
// A lens "covers" a sensor mode when its diameter ≥ the diagonal of the used
// sensor area (or full sensor area when usedSensorWidthMm is unset).
export type LensSpec = {
  id: string;
  name: string;
  /** Image-circle diameter in mm. */
  diameterMm: number;
  /** Mount system or family hint. */
  family:
    | "Spherical S35"
    | "Spherical FF/VV"
    | "Spherical Large Format"
    | "Anamorphic S35"
    | "Anamorphic FF/VV"
    | "Anamorphic Large Format";
  notes?: string;
};

export const LENSES: LensSpec[] = [
  { id: "none", name: "— No lens (skip check) —", diameterMm: 999, family: "Spherical FF/VV" },
  { id: "cooke-s4", name: "Cooke S4/i", diameterMm: 33, family: "Spherical S35", notes: "Classic Super 35 prime — does not cover Full Frame." },
  { id: "zeiss-supreme-ff", name: "Zeiss Supreme Prime", diameterMm: 44, family: "Spherical FF/VV", notes: "Covers full frame; common large-format choice." },
  { id: "arri-signature", name: "ARRI Signature Prime", diameterMm: 46, family: "Spherical FF/VV", notes: "ARRI's flagship LF/VV image circle." },
  { id: "panavision-primo-artiste", name: "Panavision Primo Artiste", diameterMm: 46, family: "Spherical FF/VV" },
  { id: "cooke-anamorphic-ffplus", name: "Cooke Anamorphic /i FF+", diameterMm: 46.3, family: "Anamorphic FF/VV", notes: "1.8× squeeze; ~Ø46.3 mm image circle covers full frame." },

  // --- Spherical Super 35 (image circle ~Ø31–34 mm) ---
  { id: "zeiss-master-prime", name: "Zeiss Master Prime", diameterMm: 33, family: "Spherical S35", notes: "High-speed S35 prime; does not cover full frame." },
  { id: "zeiss-ultra-prime", name: "Zeiss Ultra Prime", diameterMm: 32, family: "Spherical S35" },
  { id: "cooke-panchro", name: "Cooke Panchro/i Classic", diameterMm: 34, family: "Spherical S35" },
  { id: "canon-cne", name: "Canon CN-E Prime", diameterMm: 31, family: "Spherical S35" },
  { id: "zeiss-cp3", name: "Zeiss CP.3", diameterMm: 43, family: "Spherical FF/VV", notes: "CP.3 covers full frame." },

  // --- Spherical Full Frame / VistaVision (image circle ~Ø43–47 mm) ---
  { id: "cooke-s7", name: "Cooke S7/i FF", diameterMm: 46.3, family: "Spherical FF/VV" },
  { id: "tokina-vista", name: "Tokina Vista", diameterMm: 46.7, family: "Spherical FF/VV" },
  { id: "sigma-cine-ff", name: "Sigma Cine FF High Speed", diameterMm: 43.3, family: "Spherical FF/VV" },
  { id: "canon-sumire", name: "Canon Sumire Prime", diameterMm: 46.3, family: "Spherical FF/VV" },
  { id: "leica-summicron-c", name: "Leitz Summicron-C", diameterMm: 36, family: "Spherical S35", notes: "S35 coverage; some focal lengths cover larger." },

  // --- Large Format / 65 (image circle ~Ø58–60 mm) ---
  { id: "leica-thalia", name: "Leitz Thalia", diameterMm: 60, family: "Spherical Large Format", notes: "Covers ALEXA 65 / large format." },
  { id: "arri-prime-dna", name: "ARRI Prime DNA", diameterMm: 60, family: "Spherical Large Format", notes: "Large-format / 65 coverage." },

  // --- Anamorphic Super 35 (2x; image circle ~Ø31–34 mm) ---
  { id: "zeiss-master-ana", name: "ARRI/Zeiss Master Anamorphic", diameterMm: 33, family: "Anamorphic S35", notes: "S35 2x anamorphic coverage." },
  { id: "hawk-vlite", name: "Hawk V-Lite 2x", diameterMm: 33, family: "Anamorphic S35", notes: "S35 2x anamorphic." },
  { id: "atlas-orion", name: "Atlas Orion 2x", diameterMm: 33, family: "Anamorphic S35", notes: "S35 2x anamorphic." },
  { id: "panavision-cseries", name: "Panavision C-Series 2x", diameterMm: 32, family: "Anamorphic S35", notes: "Classic S35 2x anamorphic." },

  // --- Anamorphic Full Frame / VistaVision ---
  { id: "panavision-ultravista", name: "Panavision Ultra Vista 1.65x", diameterMm: 46, family: "Anamorphic FF/VV", notes: "Full-frame 1.65x anamorphic." },
  { id: "atlas-mercury", name: "Atlas Mercury 1.5x", diameterMm: 44, family: "Anamorphic FF/VV", notes: "Full-frame 1.5x anamorphic." },

  // --- Anamorphic Large Format / 65 ---
  { id: "hawk65", name: "Hawk65 2x", diameterMm: 60, family: "Anamorphic Large Format", notes: "65 / large-format 2x anamorphic." },
];

// --- Field of view + depth of field ----------------------------------------
export type FovDof = {
  hAOV: number; vAOV: number; dAOV: number; // angles of view (degrees)
  frameW: number; frameH: number;           // subject-plane coverage (metres)
  cocMm: number;                            // circle of confusion (mm)
  hyperfocalM: number;
  nearM: number;
  farM: number;                             // Infinity when at/over hyperfocal
  dofM: number;                             // Infinity when far is infinite
};

/** Thin-lens FOV + DoF. Anamorphic horizontal AOV uses focal ÷ squeeze.
 *  CoC = used-sensor diagonal ÷ 1500. All distances in metres / mm as labelled. */
export function computeFovDof(opts: {
  sensorWidthMm: number;
  sensorHeightMm: number;
  squeeze?: number;
  focalMm: number;
  fNumber: number;
  distanceM: number;
}): FovDof {
  const { sensorWidthMm: sw, sensorHeightMm: sh, focalMm: f, fNumber, distanceM } = opts;
  const sq = opts.squeeze || 1;
  const DEG = 180 / Math.PI;
  const dist = distanceM * 1000; // mm
  const hAOV = 2 * Math.atan((sw * sq) / (2 * f)) * DEG;
  const vAOV = 2 * Math.atan(sh / (2 * f)) * DEG;
  const dAOV = 2 * Math.atan(Math.hypot(sw * sq, sh) / (2 * f)) * DEG;
  const frameW = (2 * dist * Math.tan(hAOV / 2 / DEG)) / 1000;
  const frameH = (2 * dist * Math.tan(vAOV / 2 / DEG)) / 1000;
  const cocMm = Math.hypot(sw, sh) / 1500;
  const H = (f * f) / (fNumber * cocMm) + f; // mm
  const near = (H * dist) / (H + (dist - f));
  const farDen = H - (dist - f);
  const far = farDen <= 0 ? Infinity : (H * dist) / farDen;
  return {
    hAOV, vAOV, dAOV, frameW, frameH, cocMm,
    hyperfocalM: H / 1000,
    nearM: near / 1000,
    farM: far === Infinity ? Infinity : far / 1000,
    dofM: far === Infinity ? Infinity : (far - near) / 1000,
  };
}

/** Diagonal (mm) of the actually-used sensor area for a source. */
export function usedSensorDiagonalMm(src: SourceFormat): number | null {
  const w = src.usedSensorWidthMm ?? src.sensorWidthMm;
  const h = src.usedSensorHeightMm ?? src.sensorHeightMm;
  if (!w || !h) return null;
  return Math.sqrt(w * w + h * h);
}

// --- Card / runtime helpers -------------------------------------------------
// Standard on-set storage media — capacities in GB.
// `vendors` = camera brands this media is commonly used in (matched against
// the first word of SourceFormat.camera). `kind` controls label ("card" vs "mag").
export type CardSpec = {
  id: string;
  name: string;
  gb: number;
  kind?: "card" | "mag" | "drive";
  vendors?: string[];
};
export const CARDS: CardSpec[] = [
  { id: "cfx-512",   name: "CFexpress Type B 512 GB", gb: 512,  kind: "card", vendors: ["ARRI", "Sony", "Canon", "Blackmagic", "Nikon", "Panasonic"] },
  { id: "cfx-1tb",   name: "CFexpress Type B 1 TB",   gb: 1000, kind: "card", vendors: ["ARRI", "Sony", "Canon", "Blackmagic", "Nikon", "Panasonic"] },
  { id: "cfx-2tb",   name: "CFexpress Type B 2 TB",   gb: 2000, kind: "card", vendors: ["ARRI", "Sony", "Canon", "Blackmagic", "Nikon", "Panasonic"] },
  { id: "cfx4-1tb",  name: "CFexpress 4.0 Type B 1 TB", gb: 1000, kind: "card", vendors: ["ARRI", "Sony", "Canon", "Blackmagic", "Nikon", "Panasonic"] },
  { id: "cfx4-2tb",  name: "CFexpress 4.0 Type B 2 TB", gb: 2000, kind: "card", vendors: ["ARRI", "Sony", "Canon", "Blackmagic", "Nikon", "Panasonic"] },
  { id: "codex-1tb", name: "Codex Compact Drive 1 TB", gb: 1000, kind: "mag",  vendors: ["ARRI"] },
  { id: "codex-2tb", name: "Codex Compact Drive 2 TB", gb: 2000, kind: "mag",  vendors: ["ARRI"] },
  { id: "codex-4tb", name: "Codex Compact Drive 4 TB", gb: 4000, kind: "mag",  vendors: ["ARRI"] },
  { id: "red-13tb",  name: "RED Pro CFexpress 1.3 TB", gb: 1300, kind: "card", vendors: ["RED"] },
  { id: "sxs-256",   name: "Sony SxS Pro+ 256 GB",     gb: 256,  kind: "card", vendors: ["Sony"] },
  { id: "sxs-512",   name: "Sony SxS Pro+ 512 GB",     gb: 512,  kind: "card", vendors: ["Sony"] },
  { id: "axs-1tb",   name: "Sony AXSM A-Series 1 TB",  gb: 1000, kind: "mag",  vendors: ["Sony"] },
  { id: "axs-2tb",   name: "Sony AXSM A-Series 2 TB",  gb: 2000, kind: "mag",  vendors: ["Sony"] },
  { id: "sd-uhsii-256", name: "SD UHS-II 256 GB",      gb: 256,  kind: "card", vendors: ["Sony", "Canon", "Panasonic", "Blackmagic"] },
  { id: "sd-uhsii-512", name: "SD UHS-II 512 GB",      gb: 512,  kind: "card", vendors: ["Sony", "Canon", "Panasonic", "Blackmagic"] },
];

/** Filter CARDS to those used in a given camera brand (e.g. "ARRI", "RED"). */
export function cardsForVendor(vendor: string): CardSpec[] {
  return CARDS.filter((c) => !c.vendors || c.vendors.includes(vendor));
}

/** Sustained offload bandwidths (MB/s) for the DIT ingest budget. */
export const OFFLOAD_BANDWIDTHS: { id: string; label: string; mbps: number }[] = [
  { id: "tb3", label: "Thunderbolt 3 / USB4 (≈800 MB/s sustained)", mbps: 800 },
  { id: "tb4", label: "Thunderbolt 4 (≈900 MB/s sustained)", mbps: 900 },
  { id: "10gbe", label: "10 GbE (≈1,100 MB/s)", mbps: 1100 },
  { id: "usb31", label: "USB 3.2 Gen 2 (≈900 MB/s)", mbps: 900 },
];

/** Minutes of recording on a card of the given GB capacity at the given Mbps. */
export function cardRuntimeMinutes(cardGB: number, mbps: number): number {
  if (mbps <= 0) return Infinity;
  // decimal GB → Mb: gb * 1000 * 8.    minutes = Mb / Mbps / 60
  return (cardGB * 1000 * 8) / mbps / 60;
}

/** Offload hours for a TB/day budget at the given offload-bandwidth (MB/s),
 *  multiplied by the number of backup copies and divided by parallel offload stations.
 *  In real-world DIT workflow, 2–4 stations run in parallel (one per card / backup target). */
export function offloadHours(
  perDayGB: number,
  copies: number,
  bandwidthMBps: number,
  stations: number = 1,
): number {
  if (bandwidthMBps <= 0) return Infinity;
  const s = Math.max(1, Math.floor(stations));
  const totalGB = perDayGB * copies;
  const totalSeconds = (totalGB * 1000) / bandwidthMBps; // decimal GB → MB
  return totalSeconds / 3600 / s;
}

// --- Netflix approval status ----------------------------------------------
// Netflix Originals require ≥90% of runtime captured on an Approved Camera.
// Source: Netflix Production Technology — Camera Approval List (late 2025).
const NETFLIX_APPROVED_PATTERNS: RegExp[] = [
  /alexa 35/i, /alexa lf/i, /alexa mini/i, /alexa 65/i, /amira/i,
  /v-raptor/i, /monstro/i, /komodo/i,
  /venice/i, /burano/i, /fx9/i, /fx6/i, /fs7/i, // FS7/FS7 II approved (4K XAVC-I)
  /c500 mk ii/i, /c500ii/i, /c400/i, /c300 mk iii/i, /c300iii/i, /r5 ?c/i, /c700/i,
  /ursa cine 12k/i, /panavision/i, /phantom/i,
  /fx3/i, // FX3 is a fully approved primary camera (firmware 2.0, XAVC S-I 4K)
];
const NETFLIX_LIMITED_PATTERNS: RegExp[] = [
  /c70/i, // C70: non-fiction only (status under review)
];

export function netflixStatusForCamera(cameraName: string): NetflixStatus | null {
  if (/reference plate/i.test(cameraName)) return null;
  for (const p of NETFLIX_LIMITED_PATTERNS) if (p.test(cameraName)) return "limited";
  for (const p of NETFLIX_APPROVED_PATTERNS) if (p.test(cameraName)) return "approved";
  return "not-approved";
}

export function netflixStatusLabel(s: NetflixStatus | null): string {
  switch (s) {
    case "approved":     return "Netflix Approved";
    case "limited":      return "Netflix Limited Use";
    case "not-approved": return "Not Netflix-approved";
    default:             return "";
  }
}

// --- Lens / sensor compatibility -----------------------------------------
/** True when the lens family doesn't match the source's squeeze.
 *  Anamorphic lens on a spherical capture mode (or vice-versa) produces wrong
 *  squeeze and unusable footage. */
export function lensAnamorphicMismatch(lens: LensSpec, src: SourceFormat): boolean {
  if (lens.id === "none") return false;
  const lensIsAna = lens.family.toLowerCase().includes("anamorphic");
  const sensorIsAna = src.squeeze !== 1;
  return lensIsAna !== sensorIsAna;
}
