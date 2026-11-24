'use client';
import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Tags } from 'lucide-react';
import { useCatalog } from '@/lib/catalog';
import { errMsg } from '@/lib/api';
import { useCategories, type Category } from '@/lib/admin-data';

export default function CategoryManagement() {
  const { items, add, update, remove } = useCategories();
  const { items: products } = useCatalog();
  const [form, setForm] = useState<Partial<Category> | null>(null);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const count = (name: string) => products.filter((p) => p.category === name).length;
  const close = () => { setForm(null); setError(''); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const name = (form.name ?? '').trim();
    if (!name) return setError('Category name is required.');
    if (items.some((c) => c.id !== form.id && c.name.toLowerCase() === name.toLowerCase())) return setError('A category with this name already exists.');
    const description = (form.description ?? '').trim();
    try {
      if (form.id) await update(form.id, name, description);
      else await add(name, description);
      close();
    } catch (e) { setError(errMsg(e)); }
  }

  return (
    <main className="inner-page admin-page">
      <div className="page-intro">
        <span className="eyebrow">NEXORA / CATEGORIES</span>
        <h1>Category <em>management.</em></h1>
        <p>Add, edit and delete product categories. Renaming a category also updates its products. Saved to the database.</p>
      </div>

      <div className="admin-preview">
        <div className="inv-tools">
          <span className="muted-note" style={{ flex: 1, padding: 0 }}>{items.length} categories · {products.length} products</span>
          <button className="button button-orange" onClick={() => setForm({ name: '', description: '' })}><Plus size={16} /> Add category</button>
        </div>
        <div className="cat-grid">
          {items.map((c) => (
            <div className="cat-card" key={c.id}>
              <div className="cat-icon"><Tags size={18} /></div>
              <h3>{c.name}</h3>
              <p>{c.description || 'No description.'}</p>
              <small className="pill in">{count(c.name)} products</small>
              <div className="row-actions" style={{ marginTop: 16 }}>
                <button onClick={() => setForm(c)}><Pencil size={15} /> Edit</button>
                <button className="danger" onClick={() => setToDelete(c)}><Trash2 size={15} /> Delete</button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="muted-note">No categories yet. Add your first one.</p>}
        </div>
      </div>

      {form && (
        <div className="modal" role="dialog" aria-modal="true" onClick={close}>
          <form className="modal-card small" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
            <div className="modal-head"><h2>{form.id ? 'Edit category' : 'Add category'}</h2><button type="button" onClick={close} aria-label="Close"><X size={18} /></button></div>
            <label className="full">Name<input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Fitness" autoFocus />{error && <small className="err" role="alert">{error}</small>}</label>
            <label className="full">Description<textarea rows={3} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="modal-foot"><button type="button" className="button" onClick={close}>Cancel</button><button className="button button-orange" type="submit">{form.id ? 'Save changes' : 'Add category'}</button></div>
          </form>
        </div>
      )}

      {toDelete && (
        <div className="modal" role="alertdialog" aria-modal="true" onClick={() => setToDelete(null)}>
          <div className="modal-card small" onClick={(e) => e.stopPropagation()}>
            <h2>Delete “{toDelete.name}”?</h2>
            <p className="muted-note">{count(toDelete.name) > 0 ? `${count(toDelete.name)} product(s) use this category. They will keep the name but it won’t be listed here.` : 'This category has no products.'}</p>
            <div className="modal-foot"><button className="button" onClick={() => setToDelete(null)}>Keep it</button><button className="button danger-btn" onClick={async () => { try { await remove(toDelete.id); } catch (e) { alert(errMsg(e)); } setToDelete(null); }}>Delete</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
