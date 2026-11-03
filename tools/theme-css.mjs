import { colorHsl } from '../shared/colors.js';
const tokens = new Map();
export function themeCSS(source) {
  return source.replace(/#[a-f\d]{8}\b|#[a-f\d]{6}\b|#[a-f\d]{4}\b|#[a-f\d]{3}\b/gi, (hex) => {
    const c = colorHsl(hex);
    if (c.s < 0.04 || (c.h > 70 && c.h < 265)) return hex;
    const id = '--t-' + hex.slice(1).toLowerCase();
    const delta = Math.max(-40, Math.min(40, c.h > 180 ? c.h - 350 : c.h + 10));
    tokens.set(
      id,
      `hsl(calc(var(--brand-hue) + ${delta.toFixed(2)}) clamp(0%,calc(${(c.s * 100).toFixed(2)}% * var(--brand-chroma)),100%) clamp(0%,calc(${(c.l * 100).toFixed(2)}% + var(--brand-lift)),100%) / ${c.a.toFixed(4)})`
    );
    return `var(${id})`;
  });
}
export const themeVariables = () =>
  `:root{--brand-hue:350;--brand-chroma:1;--brand-lift:0%;${[...tokens].map(([key, value]) => `${key}:${value}`).join(';')}}`;
