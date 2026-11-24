'use client';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Check } from 'lucide-react';
import { readImage } from '@/lib/catalog';
import { errMsg } from '@/lib/api';
import { useSettings, seedSettings, type Settings } from '@/lib/admin-data';

export default function WebsiteSettings() {
  const [saved, setSaved, resetSaved] = useSettings();
  const [form, setForm] = useState<Settings>(seedSettings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setForm(saved), [saved]);
  const set = (k: keyof Settings, v: string) => { setForm((f) => ({ ...f, [k]: v })); setDone(false); };
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  async function pick(file?: File) {
    if (!file) return;
    try { set('logo', await readImage(file)); setErrors((e) => ({ ...e, logo: '' })); }
    catch (err) { setErrors((e) => ({ ...e, logo: (err as Error).message })); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!form.storeName.trim()) err.storeName = 'Store name is required.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) err.email = 'Enter a valid email address.';
    if (form.phone.replace(/\D/g, '').length < 10) err.phone = 'Enter a valid phone number.';
    setErrors(err);
    if (Object.keys(err).length) return;
    try { await setSaved({ ...form, storeName: form.storeName.trim(), email: form.email.trim() }); setDone(true); }
    catch (e) { setErrors({ storeName: errMsg(e) }); }
  }

  const field = (k: keyof Settings, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>{label}<input value={form[k]} onChange={(e) => set(k, e.target.value)} {...props} />{errors[k] && <small className="err">{errors[k]}</small>}</label>
  );

  return (
    <main className="inner-page admin-page">
      <div className="page-intro">
        <span className="eyebrow">NEXORA / SETTINGS</span>
        <h1>Website <em>settings.</em></h1>
        <p>Store name, logo and contact information. Saved to the database — the header and footer of the public site use these.</p>
      </div>
      <form className="admin-preview settings-form" onSubmit={submit} noValidate>
        <h2>Store identity</h2>
        <div className="logo-row">
          <div className="logo-box" style={form.logo ? { backgroundImage: `url('${form.logo}')` } : undefined}>{!form.logo && <ImagePlus size={24} />}</div>
          <div>
            <div className="drop-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="button" onClick={() => fileRef.current?.click()}>{form.logo ? 'Change logo' : 'Upload logo'}</button>
              {form.logo && <button type="button" className="inv-reset" onClick={() => set('logo', '')}>Remove</button>}
            </div>
            <small className="muted-note" style={{ display: 'block', padding: '8px 0 0' }}>JPG, PNG or WebP · max 5 MB · square works best</small>
            {errors.logo && <small className="err" role="alert">{errors.logo}</small>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        </div>
        <div className="field-grid">{field('storeName', 'Store name')}{field('tagline', 'Tagline')}</div>

        <h2 style={{ marginTop: 28 }}>Contact information</h2>
        <div className="field-grid">
          {field('email', 'Support email', { type: 'email' })}{field('phone', 'Phone', { type: 'tel' })}
          {field('whatsapp', 'WhatsApp', { type: 'tel' })}{field('hours', 'Opening hours')}
          {field('facebook', 'Facebook')}{field('instagram', 'Instagram')}
        </div>
        <label className="full">Store address<textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} /></label>

        <div className="modal-foot" style={{ alignItems: 'center' }}>
          {done && <span className="saved-note"><Check size={15} /> Settings saved</span>}
          <button type="button" className="button" onClick={() => { resetSaved().catch((e) => setErrors({ storeName: errMsg(e) })); setDone(false); }}>Restore defaults</button>
          <button className="button button-orange" type="submit" disabled={!dirty}>Save settings</button>
        </div>
      </form>
    </main>
  );
}
