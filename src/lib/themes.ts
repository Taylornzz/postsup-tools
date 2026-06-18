// Theme registry. Dark is the :root default (in index.css); every other theme is a
// `html[data-theme="<id>"]` palette in themes.css. The legacy `.light` class is kept as a
// derived "is this a light theme" flag (React Flow / WorkflowBuilder reads it).

export type ThemeId =
  | "dark" | "light" | "nordic" | "espresso" | "terminal" | "dusk"
  | "neon" | "candy" | "latte" | "mint" | "sakura" | "peach";

export type ThemeDef = {
  id: ThemeId;
  name: string;
  light: boolean;
  /** "H S% L%" of the theme's surface — drives the picker chip background. */
  bg: string;
  /** "H S% L%" of the theme's primary accent — drives the picker chip dot. */
  accent: string;
};

// Order shown in the picker grid.
export const THEMES: ThemeDef[] = [
  { id: "dark",     name: "Dark",     light: false, bg: "240 6% 7%",   accent: "33 100% 50%" },
  { id: "light",    name: "Light",    light: true,  bg: "240 8% 86%",  accent: "28 86% 42%" },
  { id: "nordic",   name: "Nordic",   light: false, bg: "220 16% 14%", accent: "193 43% 60%" },
  { id: "espresso", name: "Espresso", light: false, bg: "24 20% 9%",   accent: "32 80% 55%" },
  { id: "terminal", name: "Terminal", light: false, bg: "132 10% 5%",  accent: "135 80% 55%" },
  { id: "dusk",     name: "Dusk",     light: false, bg: "252 26% 11%", accent: "268 80% 68%" },
  { id: "neon",     name: "Neon",     light: false, bg: "276 22% 6%",  accent: "320 100% 60%" },
  { id: "candy",    name: "Candy",    light: false, bg: "292 28% 12%", accent: "330 90% 65%" },
  { id: "latte",    name: "Latte",    light: true,  bg: "36 38% 88%",  accent: "26 75% 42%" },
  { id: "mint",     name: "Mint",     light: true,  bg: "155 28% 90%", accent: "168 65% 32%" },
  { id: "sakura",   name: "Sakura",   light: true,  bg: "345 45% 93%", accent: "338 65% 50%" },
  { id: "peach",    name: "Peach",    light: true,  bg: "22 60% 91%",  accent: "14 80% 52%" },
];

const STORAGE_KEY = "kaos-theme";
const BY_ID = new Map(THEMES.map((t) => [t.id, t]));
// Light-theme ids — keep in sync with the inline pre-paint script in index.html.
export const LIGHT_THEME_IDS = THEMES.filter((t) => t.light).map((t) => t.id);

export const isLightTheme = (id: string): boolean => !!BY_ID.get(id as ThemeId)?.light;

export function loadThemeId(): ThemeId {
  try { const v = localStorage.getItem(STORAGE_KEY); if (v && BY_ID.has(v as ThemeId)) return v as ThemeId; } catch { /* ignore */ }
  return "dark";
}

/** Apply a theme: set the data-theme attribute (none for dark), keep `.light` in sync, persist. */
export function applyTheme(id: ThemeId) {
  const el = document.documentElement;
  if (id === "dark") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", id);
  el.classList.toggle("light", isLightTheme(id));
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}
