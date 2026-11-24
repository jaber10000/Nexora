'use client';
import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { presets, type PresetId, type Range } from '@/lib/dashboard';

export function DateFilter({ preset, range, onChange }: { preset: PresetId; range: Range; onChange: (p: PresetId, r: Range) => void }) {
  const [draft, setDraft] = useState<Range>(range);
  const invalid = !draft.start || !draft.end || draft.start > draft.end;

  return (
    <div className="dash-filter">
      <div className="inv-filters" role="group" aria-label="Date range">
        {presets.map((p) => (
          <button key={p.id} className={preset === p.id ? 'active' : ''} onClick={() => { const r = p.range(); setDraft(r); onChange(p.id, r); }}>{p.label}</button>
        ))}
        <button className={preset === 'custom' ? 'active' : ''} onClick={() => onChange('custom', draft)}><CalendarDays size={13} /> Custom</button>
      </div>
      {preset === 'custom' && (
        <div className="dash-custom">
          <input type="date" aria-label="Start date" value={draft.start} max={draft.end || undefined} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
          <span>to</span>
          <input type="date" aria-label="End date" value={draft.end} min={draft.start || undefined} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
          <button className="button button-orange dash-apply" disabled={invalid} onClick={() => onChange('custom', draft)}>Apply</button>
        </div>
      )}
    </div>
  );
}
