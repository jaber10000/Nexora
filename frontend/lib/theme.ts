// NEXORA theme engine — the single source of truth for every colour in the app.
// A theme is just 7 colours. deriveTokens() turns them into the full CSS-variable set
// (surfaces, text, status colours, chart colours, shadows…) and guarantees WCAG AA contrast
// for every text colour, so presets AND custom themes stay readable.

export type Colors = {
  primary: string; secondary: string; accent: string;
  background: string; surface: string; text: string; border: string;
};
export type PresetId = 'light' | 'dark' | 'ocean' | 'emerald';
export type Selection = PresetId | 'system' | 'custom';
export type Appearance = { selection: Selection; custom: Colors };
export type Tokens = Record<string, string>;

export const PRESETS: Record<PresetId, { id: PresetId; name: string; tagline: string; colors: Colors }> = {
  light: {
    id: 'light', name: 'Light', tagline: 'Clean and editorial',
    colors: { background: '#F6F7F9', surface: '#FFFFFF', primary: '#17212B', secondary: '#315CFF', accent: '#315CFF', text: '#17212B', border: '#E5E8ED' },
  },
  dark: {
    id: 'dark', name: 'Dark', tagline: 'Low-glare midnight',
    colors: { background: '#151A23', surface: '#222B38', primary: '#FFFFFF', secondary: '#6C8CFF', accent: '#6C8CFF', text: '#F3F5F8', border: '#364152' },
  },
  ocean: {
    id: 'ocean', name: 'Ocean Blue', tagline: 'Calm coastal teal',
    colors: { background: '#EAF4F7', surface: '#FFFFFF', primary: '#16485A', secondary: '#0A6B83', accent: '#087E9B', text: '#193B49', border: '#CFE3EA' },
  },
  emerald: {
    id: 'emerald', name: 'Emerald', tagline: 'Fresh natural green',
    colors: { background: '#EFF5EF', surface: '#FFFFFF', primary: '#17452F', secondary: '#1D5F3E', accent: '#24734D', text: '#20392C', border: '#D3E3D5' },
  },
};
export const PRESET_ORDER: PresetId[] = ['light', 'dark', 'ocean', 'emerald'];

export const COLOR_FIELDS: { key: keyof Colors; label: string; hint: string }[] = [
  { key: 'primary', label: 'Primary', hint: 'Headings, main buttons, footer' },
  { key: 'secondary', label: 'Secondary', hint: 'Links, hover states' },
  { key: 'accent', label: 'Accent', hint: 'Highlights, badges, charts' },
  { key: 'background', label: 'Background', hint: 'Page background' },
  { key: 'surface', label: 'Surface', hint: 'Cards, forms, modals, tables' },
  { key: 'text', label: 'Text', hint: 'Body copy' },
  { key: 'border', label: 'Border', hint: 'Dividers and outlines' },
];

export const DEFAULT_APPEARANCE: Appearance = { selection: 'light', custom: { ...PRESETS.light.colors } };
export const SELECTIONS: Selection[] = ['light', 'dark', 'ocean', 'emerald', 'system', 'custom'];

/* ------------------------------ colour maths ------------------------------ */
export function normalizeHex(v: string): string | null {
  let s = (v || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(s) ? '#' + s.toUpperCase() : null;
}
const rgbOf = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((n) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0')).join('').toUpperCase();
/** t = share of `b` in the result (0 → a, 1 → b). */
export const mixHex = (a: string, b: string, t: number) => {
  const x = rgbOf(a), y = rgbOf(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
};
export function luminance(h: string) {
  const [r, g, b] = rgbOf(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const INK = '#0B1220', WHITE = '#FFFFFF';
/** Readable text colour (white or ink) for use on `bg`. */
export const bestOn = (bg: string) => (contrast(bg, WHITE) >= contrast(bg, INK) ? WHITE : INK);
const spaced = (h: string) => rgbOf(h).join(' ');

/** Nudges `fg` toward black/white (or `toward`) until it meets every [background, ratio] pair. */
export function ensureContrast(fg: string, against: [string, number][], toward?: string) {
  const ok = (c: string) => against.every(([bg, min]) => contrast(c, bg) >= min);
  if (ok(fg)) return fg;
  const target = toward ?? (against.reduce((s, [b]) => s + luminance(b), 0) / against.length > 0.45 ? '#000000' : WHITE);
  for (let t = 0.04; t <= 1.001; t += 0.04) { const c = mixHex(fg, target, t); if (ok(c)) return c; }
  return target;
}
const darken = (h: string, max = 0.18) => { let c = h; for (let t = 0.05; luminance(c) > max && t <= 1; t += 0.05) c = mixHex(h, '#000000', t); return c; };

/* ----------------------------- token derivation ---------------------------- */
export function deriveTokens(c: Colors): Tokens {
  const bg = c.background, sf = c.surface;
  const dark = luminance(bg) < luminance(c.text);
  const toward = dark ? WHITE : '#000000';
  const textOn = (min = 4.5): [string, number][] => [[sf, min], [bg, min]];

  const text = ensureContrast(c.text, textOn());
  const textSoft = ensureContrast(mixHex(text, sf, 0.38), textOn(), text);
  const primary = ensureContrast(c.primary, textOn());
  const accent = ensureContrast(c.accent, [[sf, 4.5], [bg, 3]]);
  const secondary = ensureContrast(c.secondary, [[sf, 4.5], [bg, 3]]);
  const flip = (h: string) => (luminance(h) > 0.5 ? '#000000' : WHITE);

  // "strong" = the dark band used by the hero, footer, sidebar and banners (always dark-ish)
  const strongBase = dark ? sf : primary;
  const strong = luminance(strongBase) <= 0.22 ? strongBase : darken(strongBase);
  const onStrong = bestOn(strong);

  const base = dark
    ? { success: '#4CC38A', error: '#FF8A7A', warning: '#F0B35A', info: '#7FB2E5', violet: '#B7A5F0' }
    : { success: '#23865B', error: '#E45D4D', warning: '#A86A0F', info: '#2A5F8C', violet: '#5B45A0' };
  const status: Tokens = {};
  (Object.keys(base) as (keyof typeof base)[]).forEach((k) => {
    const tint = mixHex(sf, base[k], dark ? 0.16 : 0.12);
    const fg = ensureContrast(base[k], [[sf, 4.5], [bg, 4.5], [tint, 4.5]]);
    status[`--${k}`] = fg; status[`--${k}-bg`] = tint; status[`--${k}-border`] = mixHex(sf, base[k], 0.32); status[`--on-${k}`] = bestOn(fg);
  });

  const accentLight = mixHex(sf, accent, dark ? 0.2 : 0.12);
  const shadowRgb = dark ? '0 0 0' : spaced(text);
  const [a1, a2, a3] = dark ? [0.3, 0.38, 0.55] : [0.06, 0.08, 0.14];

  return {
    'color-scheme': dark ? 'dark' : 'light',
    '--bg': bg, '--surface': sf, '--surface-alt': bg, '--text': text, '--text-soft': textSoft, '--ink': text,
    '--border': c.border, '--border-strong': mixHex(c.border, text, 0.2), '--border-soft': mixHex(sf, c.border, 0.55),
    '--hover': mixHex(sf, text, 0.06),
    '--primary': primary, '--primary-hover': mixHex(primary, flip(primary), 0.14), '--on-primary': bestOn(primary),
    '--secondary': secondary, '--secondary-hover': mixHex(secondary, toward, 0.14), '--on-secondary': bestOn(secondary),
    '--accent': accent, '--accent-hover': mixHex(accent, toward, 0.14), '--on-accent': bestOn(accent),
    '--accent-light': accentLight, '--accent-rgb': spaced(accent),
    '--accent-on-dark': ensureContrast(c.accent, [[strong, 4.5]], WHITE),
    '--strong': strong, '--strong-2': mixHex(strong, '#000000', 0.35), '--on-strong': onStrong, '--on-strong-rgb': spaced(onStrong),
    '--on-media': WHITE,
    ...status,
    '--warning-fill': base.warning, '--success-fill': base.success, '--error-fill': base.error,
    '--chart-1': accent, '--chart-2': mixHex(accent, WHITE, 0.38), '--chart-3': status['--violet'],
    '--chart-4': dark ? '#4FC3C8' : '#1E8A8F', '--chart-5': dark ? '#F0B35A' : '#E2A93B',
    '--chart-ink': text, '--chart-muted': mixHex(c.border, text, 0.3), '--chart-grid': c.border,
    '--shadow-rgb': shadowRgb,
    '--shadow-sm': `0 1px 2px rgb(${shadowRgb} / ${a1})`,
    '--shadow': `0 1px 2px rgb(${shadowRgb} / ${+(a1 - 0.01).toFixed(2)}), 0 6px 20px rgb(${shadowRgb} / ${a2})`,
    '--shadow-lg': `0 2px 4px rgb(${shadowRgb} / ${a1}), 0 18px 44px rgb(${shadowRgb} / ${a3})`,
    '--ring': `0 0 0 3px rgb(${spaced(accent)} / .35)`,
    // legacy aliases — repeated here so they also resolve inside a scoped preview
    '--dark': primary, '--cream': bg, '--orange': secondary, '--muted': textSoft, '--line': c.border, '--white': sf,
  };
}

export const prefersDark = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function resolveColors(a: Appearance, systemDark: boolean): { id: PresetId | 'custom'; colors: Colors } {
  const sel: Selection = a.selection === 'system' ? (systemDark ? 'dark' : 'light') : a.selection;
  return sel === 'custom' ? { id: 'custom', colors: a.custom } : { id: sel, colors: PRESETS[sel].colors };
}
export const tokensFor = (a: Appearance, systemDark: boolean) => deriveTokens(resolveColors(a, systemDark).colors);

export type ContrastRow = { label: string; ratio: number; min: number; pass: boolean; fixed: boolean };
/** Contrast checks for the builder: the raw ratio the admin chose and whether auto-adjust was needed. */
export function contrastReport(c: Colors): ContrastRow[] {
  const t = deriveTokens(c);
  const rows: [string, string, string, string, string, number][] = [
    ['Text on background', c.text, c.background, t['--text'], t['--bg'], 4.5],
    ['Text on surface', c.text, c.surface, t['--text'], t['--surface'], 4.5],
    ['Primary on surface', c.primary, c.surface, t['--primary'], t['--surface'], 4.5],
    ['Accent on surface', c.accent, c.surface, t['--accent'], t['--surface'], 4.5],
    ['Secondary on surface', c.secondary, c.surface, t['--secondary'], t['--surface'], 4.5],
  ];
  return rows.map(([label, fg, bg, efg, ebg, min]) => {
    const ratio = contrast(fg, bg);
    return { label, ratio, min, pass: ratio >= min, fixed: ratio < min && contrast(efg, ebg) >= min };
  });
}
/** Applies the auto-adjusted text colours back into the editable palette. */
export function autoFixColors(c: Colors): Colors {
  const t = deriveTokens(c);
  return { ...c, text: t['--text'], primary: t['--primary'], accent: t['--accent'], secondary: t['--secondary'] };
}

/* ------------------------------ validation -------------------------------- */
export function sanitizeAppearance(raw: unknown): Appearance | null {
  const r = raw as Partial<Appearance> | null;
  if (!r || typeof r !== 'object' || !SELECTIONS.includes(r.selection as Selection)) return null;
  const custom = { ...PRESETS.light.colors };
  for (const k of Object.keys(custom) as (keyof Colors)[]) {
    const n = normalizeHex(String((r.custom as Partial<Colors> | undefined)?.[k] ?? ''));
    if (n) custom[k] = n;
  }
  return { selection: r.selection as Selection, custom };
}
export const sameAppearance = (a: Appearance, b: Appearance) =>
  a.selection === b.selection && (a.selection !== 'custom' || JSON.stringify(a.custom) === JSON.stringify(b.custom));

/* ------------------------------- DOM + cache ------------------------------ */
export const LS_LOCAL = 'nexora-theme-local';        // this browser's own preference (customers + admin mirror)
export const LS_LOCAL_PREV = 'nexora-theme-local-prev';
export const LS_GLOBAL = 'nexora-theme-global';      // last published store theme (avoids a flash)
export const LS_FX = 'nexora-theme-fx';              // resolved tokens read by the pre-paint script

export function applyTokens(tokens: Tokens, root: HTMLElement = document.documentElement) {
  Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.theme = tokens['color-scheme'] ?? 'light';
}
export const readLS = <T,>(key: string): T | null => { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
export const writeLS = (key: string, v: unknown | null) => { try { v === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(v)); } catch {} };

/** Tiny script injected in <head>: paints the saved theme before React hydrates, so there is no flash. */
export const THEME_BOOT_SCRIPT = `(function(){try{var c=JSON.parse(localStorage.getItem('${LS_FX}')||'null');if(!c)return;var t=c.s&&c.d&&window.matchMedia('(prefers-color-scheme: dark)').matches?c.d:c.t;var r=document.documentElement;for(var k in t){r.style.setProperty(k,t[k])}r.dataset.theme=t['color-scheme']||'light'}catch(e){}})();`;
