'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { InventoryListResult, LocationDto } from '@dokane/contracts';
import { api } from '../../lib/api';
import { AdjustStockModal, type AdjustTarget } from './adjust-modal';

export function StockTable({ lowOnly = false }: { lowOnly?: boolean }) {
  const [data, setData] = useState<InventoryListResult | null>(null);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [locationId, setLocationId] = useState('');
  const [page, setPage] = useState(1);
  const [adjust, setAdjust] = useState<AdjustTarget | null>(null);

  const load = useCallback(async () => {
    setData(await api.inventory.list({
      locationId: locationId || undefined,
      lowStock: lowOnly ? 'true' : undefined,
      page,
      pageSize: 20,
    }));
  }, [locationId, lowOnly, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void api.inventory.locations().then(setLocations).catch(() => undefined); }, []);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="max-w-[940px]">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">{lowOnly ? 'Low-stock alerts' : 'Stock by location'}</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {lowOnly ? 'Items at or below their alert threshold.' : 'On-hand quantity for every tracked item.'}
          </p>
        </div>
        {!lowOnly && (
          <Link href="/inventory/movements" className="rounded-full border border-line px-4 py-2.5 text-[13.5px] font-semibold text-ink hover:border-line-strong">
            View movements
          </Link>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface">
        {locations.length > 1 && (
          <div className="flex flex-wrap gap-2.5 border-b border-line p-3.5">
            <select className="h-10 rounded-xl bg-field px-3 text-[14px] text-ink outline-none" value={locationId}
              onChange={(e) => { setPage(1); setLocationId(e.target.value); }}>
              <option value="">All locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}

        {!data ? (
          <p className="p-6 text-[14px] text-muted">Loading…</p>
        ) : data.items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[15px] font-semibold">{lowOnly ? 'Nothing running low' : 'No stock yet'}</p>
            <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] text-muted">
              {lowOnly
                ? 'Every tracked item is above its alert threshold.'
                : 'Stock appears here once you add quantities to your physical products. Set the amount from any row, or from a product’s page.'}
            </p>
            {!lowOnly && (
              <Link href="/catalog" className="mt-4 inline-flex rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-on-brand">Go to products</Link>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[.06em] text-muted">
                <th className="px-4 py-2.5 text-left font-semibold">Item</th>
                <th className="px-4 py-2.5 text-left font-semibold">Location</th>
                <th className="px-4 py-2.5 text-right font-semibold">On hand</th>
                <th className="px-4 py-2.5 text-left font-semibold">Alert at</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.id}>
                  <td className="border-t border-line px-4 py-3">
                    <span className="flex items-center gap-2">
                      <b className="font-semibold">{it.label || '—'}</b>
                      {it.lowStock && (
                        <span className="rounded-full px-2 py-[2px] text-[10.5px] font-bold" style={{ background: 'rgba(217,142,75,.16)', color: '#e6ad74' }}>LOW</span>
                      )}
                    </span>
                  </td>
                  <td className="border-t border-line px-4 py-3 text-muted">{it.locationName}</td>
                  <td className="border-t border-line px-4 py-3 text-right tabular-nums font-semibold">{it.quantity}</td>
                  <td className="border-t border-line px-4 py-3 tabular-nums text-muted">{it.lowStockThreshold ?? '—'}</td>
                  <td className="border-t border-line px-4 py-3 text-right">
                    <button onClick={() => setAdjust({
                      label: it.label, locationId: it.locationId, offeringId: it.offeringId,
                      variantId: it.variantId, quantity: it.quantity, lowStockThreshold: it.lowStockThreshold,
                    })} className="font-semibold text-brand hover:underline">Adjust</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
          <span>{data.total} item{data.total === 1 ? '' : 's'}</span>
          <span className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-line px-2.5 py-1 disabled:opacity-40">Prev</button>
            Page {page} of {pages}
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-line px-2.5 py-1 disabled:opacity-40">Next</button>
          </span>
        </div>
      )}

      {adjust && (
        <AdjustStockModal target={adjust} onClose={() => setAdjust(null)} onDone={() => { setAdjust(null); void load(); }} />
      )}
    </div>
  );
}
