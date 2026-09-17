'use client';

import { useEffect, useState } from 'react';
import type { CategoryDto } from '@dokane/contracts';
import { api, ApiError } from '../../../../src/lib/api';

export default function CategoriesPage() {
  const [cats, setCats] = useState<CategoryDto[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = () => { void api.catalog.categories.list().then(setCats).catch(() => setCats([])); };
  useEffect(load, []);

  async function add() {
    const n = name.trim();
    if (!n) return;
    setError(''); setBusy(true);
    try {
      const c = await api.catalog.categories.create({ name: n, active: true });
      setCats((cs) => [...(cs ?? []), c].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the category.');
    } finally { setBusy(false); }
  }

  async function saveEdit(id: string) {
    const n = editName.trim();
    if (!n) { setEditingId(null); return; }
    const updated = await api.catalog.categories.update(id, { name: n }).catch(() => null);
    if (updated) setCats((cs) => (cs ?? []).map((c) => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)));
    setEditingId(null);
  }

  async function toggleActive(c: CategoryDto) {
    const updated = await api.catalog.categories.update(c.id, { active: !c.active }).catch(() => null);
    if (updated) setCats((cs) => (cs ?? []).map((x) => (x.id === c.id ? updated : x)));
  }

  return (
    <div className="max-w-[720px]">
      <div className="mb-1">
        <p className="mb-2 text-[12.5px] text-muted">Catalog / <span className="font-medium text-ink">Categories</span></p>
        <h1 className="text-[24px] font-bold tracking-tight">Categories</h1>
        <p className="mt-1 text-[13.5px] text-muted">Group products so they’re easier to browse and merchandise.</p>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
        <div className="flex gap-2.5">
          <input className="h-11 flex-1 rounded-xl bg-field px-3 text-[14.5px] text-ink outline-none focus:ring-1 focus:ring-brand"
            placeholder="New category name" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
          <button onClick={add} disabled={busy || !name.trim()}
            className="rounded-full bg-brand px-5 text-[13.5px] font-semibold text-on-brand hover:bg-brand-2 disabled:opacity-50">Add</button>
        </div>
        {error && <p className="mt-2 text-[12.5px]" style={{ color: 'var(--accent)' }} role="alert">{error}</p>}
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-surface">
        {!cats ? (
          <p className="p-6 text-[14px] text-muted">Loading…</p>
        ) : cats.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[15px] font-semibold">No categories yet</p>
            <p className="mx-auto mt-1 max-w-[42ch] text-[13.5px] text-muted">Add your first category above, then assign products to it from each product’s page.</p>
          </div>
        ) : (
          <ul>
            {cats.map((c) => (
              <li key={c.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                {editingId === c.id ? (
                  <input autoFocus className="h-9 flex-1 rounded-lg bg-field px-2.5 text-[14px] text-ink outline-none focus:ring-1 focus:ring-brand"
                    value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void saveEdit(c.id); if (e.key === 'Escape') setEditingId(null); }}
                    onBlur={() => void saveEdit(c.id)} />
                ) : (
                  <span className="flex flex-1 items-center gap-2">
                    <b className={`font-semibold ${c.active ? '' : 'text-muted line-through'}`}>{c.name}</b>
                    <span className="text-[12px] text-muted">{c.offeringCount} product{c.offeringCount === 1 ? '' : 's'}</span>
                    {!c.active && <span className="rounded-full bg-field px-2 py-[2px] text-[10.5px] font-semibold text-muted">Hidden</span>}
                  </span>
                )}
                <button onClick={() => { setEditingId(c.id); setEditName(c.name); }} className="text-[12.5px] font-semibold text-brand hover:underline">Rename</button>
                <button onClick={() => void toggleActive(c)} className="text-[12.5px] font-semibold text-muted hover:text-ink">{c.active ? 'Hide' : 'Show'}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
