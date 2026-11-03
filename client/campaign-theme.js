import { colorHsl } from '../shared/colors.js';
let previous = '';
export function applyCampaignTheme(campaign) {
  const accent = /^#[a-f\d]{6}$/i.test(campaign?.accent || '') ? campaign.accent : '#d92343';
  if (accent === previous) return;
  previous = accent;
  const c = colorHsl(accent),
    root = document.documentElement;
  root.style.setProperty('--brand-hue', String(c.h));
  root.style.setProperty(
    '--brand-chroma',
    String(c.s === 0 ? 0 : Math.max(0.25, Math.min(1.35, c.s / 0.72)))
  );
  root.style.setProperty('--brand-lift', ((c.l - 0.5) * 12).toFixed(2) + '%');
  root.style.setProperty('--campaign-accent', accent);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', accent);
}
