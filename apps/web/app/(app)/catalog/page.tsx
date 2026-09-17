'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { OfferingListResult } from '@dokane/contracts';
import { api, mediaUrl } from '../../../src/lib/api';

const money = (n: number) => `₪${(n / 100).toFixed(2)}`;

export default function CatalogPage() {
  const [data, setData] = useState<OfferingListResult | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setData(await api.catalog.list({ q, type: type || undefined, page, pageSize: 20 }));
  }, [q, type, page]);
  useEffect(() => { void load(); }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="max-w-[940px]">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-[13.5px] text-muted">Physical &amp; digital goods you sell.</p>
        </div>
        <Link href="/catalog/new" className="rounded-full bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-on-brand hover:bg-brand-2">+ Add product</Link>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap gap-2.5 border-b border-line p-3.5">
          <input className="h-10 flex-1 rounded-xl bg-field px-3 text-[14px] text-ink outline-none focus:ring-1 focus:ring-brand" placeholder="Search products…"
            value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
          <select className="h-10 rounded-xl bg-field px-3 text-[14px] text-ink outline-none" value={type} onChange={(e) => { setPage(1); setType(e.target.value); }}>
            <option value="">All types</option><option value="physical">Physical</option><option value="digital">Digital</option>
          </select>
        </div>

        {!data ? (
          <p className="p-6 text-[14px] text-muted">Loading…</p>
        ) : data.items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[15px] font-semibold">No products yet</p>
            <p className="mx-auto mt-1 max-w-[42ch] text-[13.5px] text-muted">Add your first product to start selling. Physical goods track stock; digital products don’t.</p>
            <Link href="/catalog/new" className="mt-4 inline-flex rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-on-brand">+ Add product</Link>
          </div>
        ) : (
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[.06em] text-muted">
                <th className="px-4 py-2.5 text-left font-semibold">Product</th>
                <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                <th className="px-4 py-2.5 text-left font-semibold">Price</th>
                <th className="px-4 py-2.5 text-left font-semibold">SKU</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id}>
                  <td className="border-t border-line px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      {o.media[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(o.media[0].url)} alt="" className="h-9 w-9 rounded-lg object-cover" />
                      ) : (
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-field text-[13px] text-muted">📦</span>
                      )}
                      <b className="font-semibold">{o.name}</b>
                      {o.variants.length > 0 && <span className="text-[12px] text-muted">· {o.variants.length} variants</span>}
                    </span>
                  </td>
                  <td className="border-t border-line px-4 py-3">
                    <span className="rounded-full px-2.5 py-[3px] text-[11px] font-bold"
                      style={o.type === 'physical' ? { background: 'rgba(14,106,87,.14)', color: '#5fd3b6' } : { background: 'rgba(217,142,75,.16)', color: '#e6ad74' }}>
                      {o.type === 'physical' ? 'Physical' : 'Digital'}
                    </span>
                  </td>
                  <td className="border-t border-line px-4 py-3 tabular-nums">{money(o.price)}</td>
                  <td className="border-t border-line px-4 py-3 tabular-nums text-muted">{o.sku ?? '—'}</td>
                  <td className="border-t border-line px-4 py-3">
                    <span className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold"
                      style={o.active ? { background: 'rgba(14,106,87,.14)', color: '#5fd3b6' } : { background: 'rgba(120,116,108,.18)', color: '#a5a097' }}>
                      {o.active ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  <td className="border-t border-line px-4 py-3 text-right">
                    <Link href={`/catalog/edit/${o.id}`} className="font-semibold text-brand hover:underline">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
          <span>{data.total} product{data.total === 1 ? '' : 's'}</span>
          <span className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-line px-2.5 py-1 disabled:opacity-40">Prev</button>
            Page {page} of {pages}
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-line px-2.5 py-1 disabled:opacity-40">Next</button>
          </span>
        </div>
      )}
    </div>
  );
}
