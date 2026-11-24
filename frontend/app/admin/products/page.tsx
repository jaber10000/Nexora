'use client';
import { useRef, useState } from 'react';
import { Plus, Pencil, Trash2, ImagePlus, X, Search, Star } from 'lucide-react';
import { formatBDT, galleryOf, type Product } from '@/lib/products';
import { errMsg } from '@/lib/api';
import { useCatalog, readImage, categories } from '@/lib/catalog';
import { stockStatus, statusLabel } from '@/lib/stock';
import { useCategories } from '@/lib/admin-data';

type Form = { id?: number; name: string; category: string; price: string; oldPrice: string; stock: string; tag: string; description: string; images: string[] };
const MAX_IMAGES = 8;
const empty: Form = { name: '', category: categories[0], price: '', oldPrice: '', stock: '10', tag: '', description: '', images: [] };
const toForm = (p: Product): Form => ({ id: p.id, name: p.name, category: p.category, price: String(p.price), oldPrice: p.oldPrice ? String(p.oldPrice) : '', stock: String(p.stock ?? 0), tag: p.tag ?? '', description: p.description ?? '', images: galleryOf(p) });

export default function ProductManagement() {
  const { items, save, remove } = useCatalog();
  const { names: catNames } = useCategories();
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [q, setQ] = useState('');
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const shown = items.filter((p) => (p.name + p.category).toLowerCase().includes(q.trim().toLowerCase()));
  const set = (k: Exclude<keyof Form, 'images'>, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const close = () => { setForm(null); setErrors({}); };

  const setImages = (fn: (list: string[]) => string[]) => setForm((f) => (f ? { ...f, images: fn(f.images) } : f));

  // Accepts several files at once (file picker with multiple, or drag & drop of many).
  async function pick(files?: FileList | File[] | null) {
    const list = Array.from(files ?? []);
    if (!list.length || !form) return;
    const room = MAX_IMAGES - form.images.length;
    if (room <= 0) return setErrors((e) => ({ ...e, image: `You can add up to ${MAX_IMAGES} images.` }));
    const added: string[] = [];
    let problem = list.length > room ? `Only ${MAX_IMAGES} images are allowed — extra files were skipped.` : '';
    for (const file of list.slice(0, room)) {
      try { added.push(await readImage(file)); } catch (err) { problem = (err as Error).message; }
    }
    if (added.length) setImages((l) => [...l, ...added].slice(0, MAX_IMAGES));
    setErrors((e) => ({ ...e, image: problem }));
  }
  const makeCover = (i: number) => setImages((l) => [l[i], ...l.filter((_, n) => n !== i)]);
  const removeAt = (i: number) => setImages((l) => l.filter((_, n) => n !== i));
  const move = (i: number, d: -1 | 1) => setImages((l) => { const n = i + d; if (n < 0 || n >= l.length) return l; const c = [...l]; [c[i], c[n]] = [c[n], c[i]]; return c; });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const price = Number(form.price), oldPrice = Number(form.oldPrice) || undefined, stock = Number(form.stock);
    const err: Record<string, string> = {};
    if (!form.name.trim()) err.name = 'Product name is required.';
    if (!(price > 0)) err.price = 'Enter a price greater than 0.';
    if (oldPrice && oldPrice <= price) err.oldPrice = 'Old price must be higher than the price.';
    if (!(stock >= 0) || !Number.isInteger(stock)) err.stock = 'Enter a whole number, 0 or more.';
    if (!form.images.length) err.image = 'Please add at least one product image.';
    setErrors(err);
    if (Object.keys(err).length) return;
    try {
      await save({ id: form.id, name: form.name.trim(), category: form.category, price, oldPrice, stock, tag: form.tag.trim() || undefined, description: form.description.trim() || undefined, image: form.images[0], images: form.images });
      close();
    } catch (e) { setErrors({ form: errMsg(e) }); }
  }

  return (
    <main className="inner-page admin-page">
      <div className="page-intro">
        <span className="eyebrow">NEXORA / PRODUCTS</span>
        <h1>Product <em>management.</em></h1>
        <p>Add, edit and delete products, with image upload. Changes are saved to the database and appear in the shop straight away.</p>
      </div>

      <div className="admin-preview">
        <div className="inv-tools">
          <label className="inv-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" /></label>
          <button className="button button-orange" onClick={() => setForm(empty)}><Plus size={16} /> Add product</button>
        </div>
        <div className="table-scroll">
          <table className="inv-table">
            <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {shown.map((p) => {
                const s = stockStatus(p.stock ?? 0);
                return (
                  <tr key={p.id}>
                    <td><div className="inv-product"><div className="inv-thumb" style={{ backgroundImage: `url('${p.image}')` }} /><div><b>{p.name}</b><small>{p.category}{galleryOf(p).length > 1 ? ` · ${galleryOf(p).length} photos` : ''}</small></div></div></td>
                    <td>{formatBDT(p.price)}</td>
                    <td><span className={`pill ${s}`}>{p.stock ?? 0} · {statusLabel[s]}</span></td>
                    <td><div className="row-actions">
                      <button onClick={() => setForm(toForm(p))} aria-label={`Edit ${p.name}`}><Pencil size={15} /> Edit</button>
                      <button className="danger" onClick={() => setToDelete(p)} aria-label={`Delete ${p.name}`}><Trash2 size={15} /> Delete</button>
                    </div></td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={4} className="muted-note">No products found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <div className="modal" role="dialog" aria-modal="true" onClick={close}>
          <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
            <div className="modal-head"><h2>{form.id ? 'Edit product' : 'Add product'}</h2><button type="button" onClick={close} aria-label="Close"><X size={18} /></button></div>

            <div className={`drop ${drag ? 'over' : ''} ${errors.image ? 'bad' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}>
              {form.images.length === 0 && <div className="drop-empty"><ImagePlus size={28} /><span>Drag images here or choose files</span><small>JPG, PNG or WebP · max 5 MB each · up to {MAX_IMAGES} images</small></div>}
              {form.images.length > 0 && (
                <ul className="img-grid" aria-label="Product images">
                  {form.images.map((src, i) => (
                    <li key={i} className={i === 0 ? 'cover' : ''} style={{ backgroundImage: `url('${src}')` }}>
                      {i === 0 ? <span className="img-badge"><Star size={11} fill="currentColor" /> Cover</span> : <button type="button" className="img-badge btn" onClick={() => makeCover(i)}>Make cover</button>}
                      <div className="img-tools">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move left">‹</button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === form.images.length - 1} aria-label="Move right">›</button>
                        <button type="button" className="rm" onClick={() => removeAt(i)} aria-label={`Remove image ${i + 1}`}><X size={14} /></button>
                      </div>
                    </li>
                  ))}
                  {form.images.length < MAX_IMAGES && <li className="img-add"><button type="button" onClick={() => fileRef.current?.click()}><Plus size={20} /><span>Add</span></button></li>}
                </ul>
              )}
              <div className="drop-actions">
                <button type="button" className="button" onClick={() => fileRef.current?.click()} disabled={form.images.length >= MAX_IMAGES}>{form.images.length ? 'Add more images' : 'Choose images'}</button>
                {form.images.length > 0 && <button type="button" className="inv-reset" onClick={() => setImages(() => [])}>Remove all</button>}
              </div>
              <small className="muted-note" style={{ padding: 0 }}>{form.images.length}/{MAX_IMAGES} · the first image is the cover shown in the shop</small>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
            </div>
            {errors.image && <small className="err" role="alert">{errors.image}</small>}

            <div className="field-grid">
              <label>Name<input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Studio Wireless Headphones" />{errors.name && <small className="err">{errors.name}</small>}</label>
              <label>Category<select value={form.category} onChange={(e) => set('category', e.target.value)}>{[...new Set([...catNames, form.category])].map((c) => <option key={c}>{c}</option>)}</select></label>
              <label>Price (৳)<input type="number" min={0} value={form.price} onChange={(e) => set('price', e.target.value)} />{errors.price && <small className="err">{errors.price}</small>}</label>
              <label>Old price (optional)<input type="number" min={0} value={form.oldPrice} onChange={(e) => set('oldPrice', e.target.value)} />{errors.oldPrice && <small className="err">{errors.oldPrice}</small>}</label>
              <label>Stock<input type="number" min={0} value={form.stock} onChange={(e) => set('stock', e.target.value)} />{errors.stock && <small className="err">{errors.stock}</small>}</label>
              <label>Tag (optional)<input value={form.tag} onChange={(e) => set('tag', e.target.value)} placeholder="New, Bestseller…" /></label>
            </div>
            <label className="full">Description<textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} /></label>

            {errors.form && <small className="err" role="alert">{errors.form}</small>}
            <div className="modal-foot"><button type="button" className="button" onClick={close}>Cancel</button><button className="button button-orange" type="submit">{form.id ? 'Save changes' : 'Add product'}</button></div>
          </form>
        </div>
      )}

      {toDelete && (
        <div className="modal" role="alertdialog" aria-modal="true" onClick={() => setToDelete(null)}>
          <div className="modal-card small" onClick={(e) => e.stopPropagation()}>
            <h2>Delete this product?</h2>
            <p className="muted-note">“{toDelete.name}” will be removed from the shop. Past orders that include it are kept.</p>
            <div className="modal-foot"><button className="button" onClick={() => setToDelete(null)}>Keep it</button><button className="button danger-btn" onClick={async () => { try { await remove(toDelete.id); } catch (e) { alert(errMsg(e)); } setToDelete(null); }}>Delete</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
