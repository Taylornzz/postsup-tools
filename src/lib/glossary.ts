import data from "./glossary-data.json";

/** Post-production glossary — built from the NZ Post-Super master reference + web research,
 *  fact-checked, deduped and HTML-cleaned. See scripts/build (workflow postsup-glossary). */

export type GlossaryCategory =
  | "Camera & Capture"
  | "Colour & HDR"
  | "ACES & Colour Mgmt"
  | "Editorial & Conform"
  | "VFX"
  | "Audio Post"
  | "Mastering & Delivery"
  | "QC & Standards"
  | "Security & Legal"
  | "NZ Industry"
  | "Roles & Paperwork";

export type GlossaryEntry = {
  term: string;
  aka?: string[];
  category: GlossaryCategory;
  definition: string;
  seeAlso?: string[];
};

export const GLOSSARY = data as GlossaryEntry[];

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  "Camera & Capture",
  "Colour & HDR",
  "ACES & Colour Mgmt",
  "Editorial & Conform",
  "VFX",
  "Audio Post",
  "Mastering & Delivery",
  "QC & Standards",
  "Security & Legal",
  "NZ Industry",
  "Roles & Paperwork",
];

export const GLOSSARY_CAT_COLOR: Record<GlossaryCategory, string> = {
  "Camera & Capture": "#38bdf8",
  "Colour & HDR": "#f59e0b",
  "ACES & Colour Mgmt": "#a78bfa",
  "Editorial & Conform": "#22d3ee",
  VFX: "#e879f9",
  "Audio Post": "#34d399",
  "Mastering & Delivery": "#fb7185",
  "QC & Standards": "#f87171",
  "Security & Legal": "#facc15",
  "NZ Industry": "#4ade80",
  "Roles & Paperwork": "#94a3b8",
};
