"use client";

/**
 * Applies the persisted theme + aesthetic tokens to <html>.
 * Keeps the document in sync with Settings without re-rendering the tree.
 */
import { useEffect } from "react";

import { FONTS, THEME_MAP, type ThemeId } from "@/lib/themes";
import { useStore } from "@/lib/store";

const HEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

function hexToRgbTriplet(hex: string): string | null {
  const m = HEX.exec(hex.trim());
  if (!m) return null;
  return `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const settings = useStore((s) => s.settings);
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    const root = document.documentElement;
    const theme = THEME_MAP[settings.theme as ThemeId] || THEME_MAP.onyx;
    root.dataset.theme = theme.id;
    root.dataset.radius = settings.radius;
    root.dataset.density = settings.density;
    root.dataset.backdrop = settings.backdrop;
    root.style.colorScheme = theme.mode;

    /* accent override — recompute the derived tokens */
    const accent = settings.accentOverride || theme.accent;
    const triplet = hexToRgbTriplet(accent);
    if (triplet) {
      root.style.setProperty("--accent", accent);
      root.style.setProperty("--glow", triplet);
      root.style.setProperty("--accent-soft", `rgb(${triplet} / 0.14)`);
      root.style.setProperty("--accent-line", `rgb(${triplet} / 0.38)`);
      root.style.setProperty("--sel", `rgb(${triplet} / 0.30)`);
      const dark = isDark(accent);
      root.style.setProperty("--accent-fg", dark ? "#04120a" : "#ffffff");
    } else {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--glow");
      root.style.removeProperty("--accent-soft");
      root.style.removeProperty("--accent-line");
      root.style.removeProperty("--sel");
      root.style.removeProperty("--accent-fg");
    }

    /* typography */
    const font = FONTS.find((f) => f.id === settings.font) || FONTS[0];
    root.style.setProperty("--font-ui", font.stack);

    /* native chrome */
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme.mode === "dark" ? "#000000" : "#f7f9fc");
  }, [settings, hydrated]);

  return <>{children}</>;
}

/** Rough luminance test so accent text stays readable. */
function isDark(hex: string): boolean {
  const m = HEX.exec(hex.trim());
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45; // bright accent → dark foreground text
}
