'use client';
// Quick appearance menu for the storefront header. Customers' choice is saved in localStorage only.
import { useEffect, useRef, useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { PRESETS, PRESET_ORDER, type Appearance, type Selection } from '@/lib/theme';

const OPTIONS: { value: Selection; label: string }[] = [
  ...PRESET_ORDER.map((id) => ({ value: id as Selection, label: PRESETS[id].name })),
  { value: 'system', label: 'Match device' },
];

export function ThemeSwitcher() {
  const { mine, global, setMine } = useTheme();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const current: Selection = (mine ?? global).selection;
  const choose = (v: Selection) => {
    // keep a custom palette around if the store default is custom
    const next: Appearance = { selection: v, custom: (mine ?? global).custom };
    setMine(next).catch(() => {});
    setOpen(false);
  };

  return (
    <div className="theme-switch" ref={box}>
      <button type="button" aria-label="Change appearance" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><Palette size={20} /></button>
      {open && (
        <div className="theme-menu" role="menu" aria-label="Appearance">
          <span className="theme-menu-title">Appearance</span>
          {OPTIONS.map((o) => (
            <button key={o.value} type="button" role="menuitemradio" aria-checked={current === o.value} className={current === o.value ? 'on' : ''} onClick={() => choose(o.value)}>
              <span>{o.label}</span>{current === o.value && <Check size={15} />}
            </button>
          ))}
          {mine && <button type="button" className="theme-reset" onClick={() => { setMine(null).catch(() => {}); setOpen(false); }}>Reset to store theme</button>}
        </div>
      )}
    </div>
  );
}
