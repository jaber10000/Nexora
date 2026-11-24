'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, Eye, Monitor, RotateCcw, History, Store, UserRound, Wand2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { errMsg } from '@/lib/api';
import { useTheme } from '@/components/theme-provider';
import { ThemePreview, ThemeThumb } from '@/components/theme-preview';
import {
  type Appearance, type Colors, type Selection, COLOR_FIELDS, DEFAULT_APPEARANCE, PRESETS, PRESET_ORDER,
  autoFixColors, contrastReport, normalizeHex, prefersDark, resolveColors, sameAppearance,
} from '@/lib/theme';

type Scope = 'store' | 'me';
const toast = (text: string, tone?: 'error') => window.dispatchEvent(new CustomEvent('nexora:toast', { detail: { text, tone } }));

function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const bad = !normalizeHex(text);
  return (
    <div className="cf">
      <label className="cf-swatch" style={{ background: value }} title={`Pick ${label.toLowerCase()} colour`}>
        <input type="color" value={value} aria-label={`${label} colour picker`} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      </label>
      <div className="cf-body">
        <b>{label}</b><small>{hint}</small>
        <input className={bad ? 'bad' : ''} value={text} maxLength={7} spellCheck={false} aria-label={`${label} HEX value`} aria-invalid={bad}
          onChange={(e) => { setText(e.target.value); const n = normalizeHex(e.target.value); if (n) onChange(n); }}
          onBlur={() => setText(normalizeHex(text) ?? value)} />
      </div>
    </div>
  );
}

export default function AppearancePage() {
  const t = useTheme();
  const [scope, setScope] = useState<Scope>('store');
  const base: Appearance = scope === 'store' ? t.global : t.mine ?? t.global;
  const [draft, setDraft] = useState<Appearance>(base);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [onSite, setOnSite] = useState(false);
  const [sysDark, setSysDark] = useState(false);

  useEffect(() => setSysDark(prefersDark()), []);
  useEffect(() => { if (!touched) setDraft(base); }, [base, touched]);
  useEffect(() => { setTouched(false); setDraft(scope === 'store' ? t.global : t.mine ?? t.global); /* eslint-disable-next-line */ }, [scope]);
  // optional: wear the draft across the whole admin while editing; always cleaned up on leave
  useEffect(() => { t.setPreview(onSite ? draft : null); /* eslint-disable-next-line */ }, [onSite, draft]);
  useEffect(() => () => t.setPreview(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !sameAppearance(draft, base);
  const edit = (a: Appearance) => { setDraft(a); setTouched(true); };
  const select = (sel: Selection) => {
    // starting "Custom" from a preset seeds the builder with that preset's colours
    const seed = sel === 'custom' && draft.selection !== 'custom' ? { ...resolveColors(draft, sysDark).colors } : draft.custom;
    edit({ selection: sel, custom: seed });
  };
  const setColor = (k: keyof Colors, v: string) => edit({ selection: 'custom', custom: { ...(draft.selection === 'custom' ? draft.custom : resolveColors(draft, sysDark).colors), [k]: v } });

  const shown = useMemo(() => resolveColors(draft, sysDark), [draft, sysDark]);
  const report = useMemo(() => contrastReport(draft.selection === 'custom' ? draft.custom : shown.colors), [draft, shown]);
  const activeId = base.selection;

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try { await fn(); setTouched(false); toast(ok); } catch (e) { toast(errMsg(e), 'error'); }
    setBusy(false);
  }
  const save = () => run(() => (scope === 'store' ? t.publishGlobal(draft) : t.setMine(draft)), scope === 'store' ? 'Theme published to the whole store' : 'Your personal appearance was saved');
  const useStoreDefault = () => run(async () => { await t.setMine(null); setDraft(t.global); }, 'Now following the store theme');
  const restore = () => {
    const prev = scope === 'store' ? t.previousGlobal : t.previousMine;
    if (prev) edit(prev);
  };
  const hasPrev = scope === 'store' ? !!t.previousGlobal : !!t.previousMine;

  const customColors = draft.selection === 'custom' ? draft.custom : shown.colors;

  return (
    <main className="inner-page admin-page appearance">
      <div className="page-intro">
        <span className="eyebrow">NEXORA / APPEARANCE</span>
        <h1>Theme <em>management.</em></h1>
        <p>Choose how the storefront and admin dashboard look. Changes preview instantly — nothing goes live until you save.</p>
      </div>

      <div className="tm-scope" role="tablist" aria-label="Where to apply the theme">
        <button role="tab" aria-selected={scope === 'store'} className={scope === 'store' ? 'on' : ''} onClick={() => setScope('store')}>
          <Store size={17} /><span><b>Entire store</b><small>Published for every visitor and admin</small></span>
        </button>
        <button role="tab" aria-selected={scope === 'me'} className={scope === 'me' ? 'on' : ''} onClick={() => setScope('me')}>
          <UserRound size={17} /><span><b>Only me</b><small>Personal preference on my account</small></span>
        </button>
      </div>
      {scope === 'store' && t.mine && <p className="tm-note"><TriangleAlert size={15} /> Your personal preference currently overrides the store theme on your own screen. Visitors will see what you publish here.</p>}
      {scope === 'me' && (
        <p className="tm-note"><UserRound size={15} /> {t.mine ? 'Saved to your account — it follows you across devices and takes priority over the store theme for you only.' : 'You are following the store theme. Save a choice below to override it just for you.'}</p>
      )}

      <section className="tm-section" aria-labelledby="tm-presets">
        <div className="tm-head"><h2 id="tm-presets">Theme presets</h2><p>Four ready-made, contrast-checked themes. Or build your own below.</p></div>
        <div className="tm-cards">
          {PRESET_ORDER.map((id) => {
            const p = PRESETS[id], selected = draft.selection === id || (draft.selection === 'system' && resolveColors(draft, sysDark).id === id), active = activeId === id;
            return (
              <article key={id} className={`tm-card${selected ? ' selected' : ''}`}>
                <ThemeThumb colors={p.colors} />
                <div className="tm-card-body">
                  <div className="tm-card-title"><h3>{p.name}</h3>{active && <span className="tm-badge"><i />Active</span>}</div>
                  <p>{p.tagline}</p>
                  <div className="tm-palette" aria-label={`${p.name} palette`}>
                    {([p.colors.background, p.colors.surface, p.colors.primary, p.colors.accent, p.colors.text] as string[]).map((c, i) => <i key={i} style={{ background: c }} title={c} />)}
                  </div>
                  <button type="button" className={`tm-select${selected ? ' on' : ''}`} aria-pressed={selected} onClick={() => select(id)}>
                    {selected ? <><Check size={16} /> Selected</> : 'Select theme'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        <label className={`tm-system${draft.selection === 'system' ? ' on' : ''}`}>
          <input type="checkbox" checked={draft.selection === 'system'} onChange={(e) => select(e.target.checked ? 'system' : 'light')} />
          <span className="tm-system-icon"><Monitor size={18} /></span>
          <span><b>Match device setting</b><small>Switches between Light and Dark automatically{draft.selection === 'system' ? ` — currently ${sysDark ? 'Dark' : 'Light'}` : ''}.</small></span>
        </label>
      </section>

      <section className="tm-section" aria-labelledby="tm-custom">
        <div className="tm-head">
          <h2 id="tm-custom">Custom theme builder {draft.selection === 'custom' && <span className="tm-badge"><i />In use</span>}</h2>
          <p>Pick colours with the swatch or type a HEX value. {draft.selection !== 'custom' && 'Editing any colour switches to Custom, starting from the current theme.'}</p>
        </div>
        <div className="tm-builder">
          <div className="tm-fields">{COLOR_FIELDS.map((f) => <ColorField key={f.key} label={f.label} hint={f.hint} value={customColors[f.key]} onChange={(v) => setColor(f.key, v)} />)}</div>
          <aside className="tm-contrast" aria-label="Contrast report">
            <h3><ShieldCheck size={16} /> Accessibility</h3>
            <ul>
              {report.map((r) => (
                <li key={r.label} className={r.pass ? 'pass' : r.fixed ? 'fixed' : 'fail'}>
                  <span>{r.label}</span><b>{r.ratio.toFixed(1)}:1</b><em>{r.pass ? 'AA' : r.fixed ? 'Auto-adjusted' : 'Low'}</em>
                </li>
              ))}
            </ul>
            <small>Text colours that fall below WCAG AA (4.5:1) are nudged automatically so every theme stays readable.</small>
            <button type="button" className="tm-ghost" disabled={report.every((r) => r.pass)} onClick={() => edit({ selection: 'custom', custom: autoFixColors(customColors) })}><Wand2 size={15} /> Apply fixes to my colours</button>
          </aside>
        </div>
      </section>

      <section className="tm-section" aria-labelledby="tm-preview">
        <div className="tm-head tm-head-row">
          <div><h2 id="tm-preview">Live preview</h2><p>Updates instantly as you change anything above.</p></div>
          <label className="tm-switch"><input type="checkbox" checked={onSite} onChange={(e) => setOnSite(e.target.checked)} /><span /><Eye size={15} /> Preview on this whole page</label>
        </div>
        <ThemePreview colors={shown.colors} />
      </section>

      <div className="tm-bar" role="region" aria-label="Save theme">
        <div className="tm-bar-info">
          {dirty ? <><i className="dot" /> Unsaved changes</> : <><Check size={15} /> {scope === 'store' ? (t.publishedAt ? `Published ${new Date(t.publishedAt).toLocaleString()}` : 'Default theme in use') : 'Up to date'}</>}
        </div>
        <div className="tm-bar-actions">
          <button type="button" className="tm-ghost" disabled={busy || !hasPrev} onClick={restore} title={hasPrev ? 'Load the previous theme into the editor' : 'No previous theme yet'}><History size={15} /> Restore previous</button>
          <button type="button" className="tm-ghost" disabled={busy || sameAppearance(draft, DEFAULT_APPEARANCE)} onClick={() => edit(DEFAULT_APPEARANCE)}><RotateCcw size={15} /> Reset to default</button>
          {scope === 'me' && t.mine && <button type="button" className="tm-ghost" disabled={busy} onClick={useStoreDefault}>Use store theme</button>}
          {dirty && <button type="button" className="tm-ghost" disabled={busy} onClick={() => { setTouched(false); setDraft(base); }}>Discard</button>}
          <button type="button" className="tm-save" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : scope === 'store' ? 'Save and Publish' : 'Save my preference'}</button>
        </div>
      </div>
    </main>
  );
}
