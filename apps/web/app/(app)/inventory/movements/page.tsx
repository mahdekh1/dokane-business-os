'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { MovementListResult } from '@dokane/contracts';
import { api } from '../../../../src/lib/api';

const TYPE_LABEL: Record<string, string> = {
  INITIAL_STOCK: 'Initial stock',
  ADJUSTMENT: 'Adjustment',
  SALE: 'Sale',
  RETURN: 'Return',
  TRANSFER_IN: 'Transfer in',
  TRANSFER_OUT: 'Transfer out',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function MovementsPage() {
  const [data, setData] = useState<MovementListResult | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setData(await api.inventory.movements({ page, pageSize: 30 }));
  }, [page]);
  useEffect(() => { void load(); }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="max-w-[940px]">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Stock movements</h1>
          <p className="mt-1 text-[13.5px] text-muted">Every change to stock, newest first.</p>
        </div>
        <Link href="/inventory" className="rounded-full border border-line px-4 py-2.5 text-[13.5px] font-semibold text-ink hover:border-line-strong">
          Back to stock
        </Link>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface">
        {!data ? (
          <p className="p-6 text-[14px] text-muted">Loading…</p>
        ) : data.items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[15px] font-semibold">No movements yet</p>
            <p className="mx-auto mt-1 max-w-[42ch] text-[13.5px] text-muted">Adjusting stock or making a sale records a movement here.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[.06em] text-muted">
                <th className="px-4 py-2.5 text-left font-semibold">When</th>
                <th className="px-4 py-2.5 text-left font-semibold">Item</th>
                <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                <th className="px-4 py-2.5 text-right font-semibold">Change</th>
                <th className="px-4 py-2.5 text-left font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={m.id}>
                  <td className="border-t border-line px-4 py-3 whitespace-nowrap text-muted tabular-nums">{when(m.createdAt)}</td>
                  <td className="border-t border-line px-4 py-3 font-medium">{m.label || '—'}</td>
                  <td className="border-t border-line px-4 py-3 text-muted">{TYPE_LABEL[m.movementType] ?? m.movementType}</td>
                  <td className="border-t border-line px-4 py-3 text-right tabular-nums font-semibold"
                    style={{ color: m.quantityDelta < 0 ? 'var(--accent)' : '#5fd3b6' }}>
                    {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                  </td>
                  <td className="border-t border-line px-4 py-3 text-muted">{m.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
          <span>{data.total} movement{data.total === 1 ? '' : 's'}</span>
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
