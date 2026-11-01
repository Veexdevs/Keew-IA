/**
 * Theme catalogue — every theme is a token set in globals.css.
 * `preview` colours are used by the settings UI swatches.
 */
export type ThemeId =
  | "onyx" | "midnight" | "obsidian" | "aurora" | "ember" | "matrix" | "cyber"
  | "sakura" | "arctic" | "papyrus" | "linen" | "solar" | "graphite" | "depth";

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  hint: string;
  mode: "dark" | "light";
  /** [background, surface, accent] */
  swatch: [string, string, string];
  accent: string;
};

export const THEMES: ThemeMeta[] = [
  { id: "onyx",     name: "Onyx",     hint: "Padrão Keew · grafite quente",   mode: "dark",  swatch: ["#141413", "#1a1a19", "#2f6bff"], accent: "#2f6bff" },
  { id: "midnight", name: "Midnight", hint: "Azul profundo",                  mode: "dark",  swatch: ["#060913", "#0d1426", "#3b82f6"], accent: "#3b82f6" },
  { id: "obsidian", name: "Obsidian", hint: "Studio monocromático",           mode: "dark",  swatch: ["#0f0f0f", "#1d1d1d", "#fafafa"], accent: "#fafafa" },
  { id: "aurora",   name: "Aurora",   hint: "Violeta crepuscular",            mode: "dark",  swatch: ["#08060f", "#130e22", "#8b5cf6"], accent: "#8b5cf6" },
  { id: "ember",    name: "Ember",    hint: "Carvão e âmbar",                 mode: "dark",  swatch: ["#0a0705", "#18110c", "#f97316"], accent: "#f97316" },
  { id: "matrix",   name: "Matrix",   hint: "Terminal fosforescente",         mode: "dark",  swatch: ["#000603", "#04150c", "#22c55e"], accent: "#22c55e" },
  { id: "cyber",    name: "Cyber",    hint: "Ciano neon",                     mode: "dark",  swatch: ["#04030a", "#0d0a1c", "#22d3ee"], accent: "#22d3ee" },
  { id: "sakura",   name: "Sakura",   hint: "Ameixa e blush",                 mode: "dark",  swatch: ["#0c0508", "#1a0b12", "#f472b6"], accent: "#f472b6" },
  { id: "graphite", name: "Graphite", hint: "Ardósia e limão",                mode: "dark",  swatch: ["#15171a", "#23272c", "#a3e635"], accent: "#a3e635" },
  { id: "depth",    name: "Depth",    hint: "Vidro oceânico",                 mode: "dark",  swatch: ["#001016", "#072630", "#06b6d4"], accent: "#06b6d4" },
  { id: "arctic",   name: "Arctic",   hint: "Luz do dia",                     mode: "light", swatch: ["#f7f9fc", "#eef2f8", "#004cfd"], accent: "#004cfd" },
  { id: "papyrus",  name: "Papyrus",  hint: "Editorial quente",               mode: "light", swatch: ["#faf6ef", "#f2ebde", "#b45309"], accent: "#b45309" },
  { id: "linen",    name: "Linen",    hint: "Neutro silencioso",              mode: "light", swatch: ["#f4f4f2", "#ecece9", "#141413"], accent: "#141413" },
  { id: "solar",    name: "Solar",    hint: "Âmbar claro",                    mode: "light", swatch: ["#fdfbf4", "#f7f1e0", "#d97706"], accent: "#d97706" },
];

export const THEME_MAP: Record<ThemeId, ThemeMeta> = Object.fromEntries(
  THEMES.map((t) => [t.id, t]),
) as Record<ThemeId, ThemeMeta>;

/** Accent overrides that work over any base theme. */
export const ACCENTS = [
  { id: "brand",  name: "Keew Blue", hex: "#0b5cff" },
  { id: "royal",  name: "Royal",     hex: "#2563eb" },
  { id: "indigo", name: "Indigo",    hex: "#6366f1" },
  { id: "violet", name: "Violet",    hex: "#8b5cf6" },
  { id: "fuchsia",name: "Fuchsia",   hex: "#d946ef" },
  { id: "rose",   name: "Rose",      hex: "#f43f5e" },
  { id: "amber",  name: "Amber",     hex: "#f59e0b" },
  { id: "lime",   name: "Lime",      hex: "#84cc16" },
  { id: "emerald",name: "Emerald",   hex: "#10b981" },
  { id: "teal",   name: "Teal",      hex: "#14b8a6" },
  { id: "cyan",   name: "Cyan",      hex: "#06b6d4" },
  { id: "slate",  name: "Slate",     hex: "#94a3b8" },
] as const;

export type RadiusId = "sharp" | "soft" | "round";
export type DensityId = "compact" | "comfortable" | "spacious";
export type FontId = "geist" | "inter" | "mono" | "serif" | "system";

export const FONTS: { id: FontId; name: string; stack: string; note: string }[] = [
  { id: "geist",  name: "Geist",   stack: "var(--font-geist-sans)", note: "Neutra e técnica" },
  { id: "inter",  name: "Inter",   stack: "Inter, var(--font-geist-sans)", note: "Interface clássica" },
  { id: "mono",   name: "Geist Mono", stack: "var(--font-geist-mono)", note: "Engenharia" },
  { id: "serif",  name: "Serif",   stack: "ui-serif, 'Iowan Old Style', Georgia, serif", note: "Editorial" },
  { id: "system", name: "Sistema", stack: "system-ui, -apple-system, 'Segoe UI'", note: "Nativo" },
];

/** Background flourishes the user can toggle on the chat canvas. */
export const BACKDROPS = [
  { id: "none",    name: "Limpo" },
  { id: "glow",    name: "Aurora" },
  { id: "grid",    name: "Grade" },
  { id: "dots",    name: "Pontos" },
  { id: "noise",   name: "Grão" },
] as const;
export type BackdropId = (typeof BACKDROPS)[number]["id"];
