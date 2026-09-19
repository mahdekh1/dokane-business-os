'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { CustomerListResult } from '@dokane/contracts';
import { api, ApiError } from '../../../../src/lib/api';
import { shortWhen } from '../../../../src/lib/format';

const SOURCE_LABEL: Record<string, string> = { MANUAL: 'Manual', ONLINE: 'Online', IMPORT: 'Import' };

export default function CustomersPage() {
  const [data, setData] = useState<CustomerListResult | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setData(await api.customers.list({ q, page, pageSize: 20 }));
  }, [q, page]);
  useEffect(() => { void load(); }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="max-w-[900px]">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Customers</h1>
          <p className="mt-1 text-[13.5px] text-muted">Everyone you’ve sold to — built automatically from orders, or add them here.</p>
        </div>
        <button onClick={() => setAdding(true)} className="rounded-full bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-on-brand hover:bg-brand-2">+ Add customer</button>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface">
        <div className="border-b border-line p-3.5">
          <input className="h-10 w-full rounded-xl bg-field px-3 text-[14px] text-ink outline-none focus:ring-1 focus:ring-brand"
            placeholder="Search by name, email or phone…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </div>
        {!data ? (
          <p className="p-6 text-[14px] text-muted">Loading…</p>
        ) : data.items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[15px] font-semibold">No customers yet</p>
            <p className="mx-auto mt-1 max-w-[42ch] text-[13.5px] text-muted">Customers appear here when you attach them to an order, or add one now.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[.06em] text-muted">
                <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                <th className="px-4 py-2.5 text-left font-semibold">Contact</th>
                <th className="px-4 py-2.5 text-left font-semibold">Source</th>
                <th className="px-4 py-2.5 text-left font-semibold">Since</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id} className="hover:bg-field/40">
                  <td className="border-t border-line px-4 py-3"><Link href={`/crm/customers/${c.id}`} className="font-semibold text-brand hover:underline">{c.name}</Link></td>
                  <td className="border-t border-line px-4 py-3 text-muted">{c.email ?? c.phone ?? '—'}</td>
                  <td className="border-t border-line px-4 py-3"><span className="rounded-full bg-field px-2.5 py-[3px] text-[11px] font-semibold text-muted">{SOURCE_LABEL[c.source] ?? c.source}</span></td>
                  <td className="border-t border-line px-4 py-3 text-muted tabular-nums">{shortWhen(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
          <span>{data.total} customer{data.total === 1 ? '' : 's'}</span>
          <span className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-line px-2.5 py-1 disabled:opacity-40">Prev</button>
            Page {page} of {pages}
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-line px-2.5 py-1 disabled:opacity-40">Next</button>
          </span>
        </div>
      )}

      {adding && <AddCustomerDialog onClose={() => setAdding(false)} onDone={() => { setAdding(false); void load(); }} />}
    </div>
  );
}

function AddCustomerDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (!name.trim()) { setError('Give the customer a name.'); return; }
    setBusy(true);
    try {
      await api.customers.create({ name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined, source: 'MANUAL' });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the customer.');
      setBusy(false);
    }
  }

  const inp = 'h-11 w-full rounded-[11px] bg-field px-3 text-[14px] text-ink outline-none focus:ring-1 focus:ring-brand';
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-[400px] rounded-2xl border border-line bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[17px] font-bold tracking-tight">Add customer</h2>
        {error && <p className="mt-3 rounded-xl border border-[color:var(--accent)] bg-field px-3.5 py-2.5 text-[13px]" role="alert">{error}</p>}
        <label className="mb-1 mt-4 block text-[12.5px] font-medium">Name</label>
        <input className={inp} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <label className="mb-1 mt-3 block text-[12.5px] font-medium">Email <span className="font-normal text-muted">(optional)</span></label>
        <input className={inp} value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="mb-1 mt-3 block text-[12.5px] font-medium">Phone <span className="font-normal text-muted">(optional)</span></label>
        <input className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Cancel</button>
          <button type="button" onClick={submit} disabled={busy} className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">{busy ? 'Adding…' : 'Add customer'}</button>
        </div>
      </div>
    </div>
  );
}
