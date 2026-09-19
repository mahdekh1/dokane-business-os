'use client';

import { useEffect, useRef, useState } from 'react';
import type { CustomerDto, OrderCustomerInput } from '@dokane/contracts';
import { api } from '../../lib/api';

type Selection =
  | { kind: 'existing'; customer: CustomerDto }
  | { kind: 'new'; name: string; email?: string; phone?: string }
  | { kind: 'ephemeral'; name: string };

/** Emits an OrderCustomerInput (or undefined) for the three modes: pick an
 *  existing customer, create+save a new one, or a walk-in name (no record). */
export function CustomerPicker({ onChange }: { onChange: (v: OrderCustomerInput | undefined) => void }) {
  const [selected, setSelected] = useState<Selection | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerDto[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) { setResults([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void api.customers.list({ q: query.trim(), pageSize: 6 }).then((r) => setResults(r.items)).catch(() => setResults([]));
    }, 200);
  }, [query, selected]);

  const emit = (s: Selection | null) => {
    setSelected(s);
    if (!s) return onChange(undefined);
    if (s.kind === 'existing') return onChange({ customerId: s.customer.id });
    if (s.kind === 'new') return onChange({ name: s.name, email: s.email || undefined, phone: s.phone || undefined, save: true });
    return onChange({ name: s.name, save: false });
  };

  const clear = () => { emit(null); setQuery(''); setNewOpen(false); setEmail(''); setPhone(''); setResults([]); };

  if (selected) {
    const label = selected.kind === 'existing' ? selected.customer.name : selected.name;
    const badge = selected.kind === 'existing' ? 'Saved' : selected.kind === 'new' ? 'New' : 'Walk-in';
    return (
      <div className="flex items-center gap-2 rounded-xl bg-field px-3 py-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand/15 text-[12px] font-bold text-brand">{label.slice(0, 1).toUpperCase()}</span>
        <span className="flex-1 text-[14px] font-medium">{label}</span>
        <span className="rounded-full bg-surface px-2 py-[2px] text-[10.5px] font-semibold text-muted">{badge}</span>
        <button type="button" onClick={clear} className="text-muted hover:text-ink" aria-label="Clear customer">✕</button>
      </div>
    );
  }

  const q = query.trim();
  return (
    <div>
      <input className="h-11 w-full rounded-xl bg-field px-3 text-[14px] text-ink outline-none focus:ring-1 focus:ring-brand"
        placeholder="Search or type a customer name" value={query} onChange={(e) => { setQuery(e.target.value); setNewOpen(false); }} />

      {q.length >= 2 && !newOpen && (
        <div className="mt-1.5 overflow-hidden rounded-xl border border-line bg-surface">
          {results.map((c) => (
            <button key={c.id} type="button" onClick={() => emit({ kind: 'existing', customer: c })}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13.5px] hover:bg-field">
              <b className="font-medium">{c.name}</b>
              {(c.email || c.phone) && <span className="text-[12px] text-muted">{c.email ?? c.phone}</span>}
            </button>
          ))}
          <button type="button" onClick={() => emit({ kind: 'ephemeral', name: q })}
            className="block w-full border-t border-line px-3 py-2 text-left text-[13px] hover:bg-field">
            Use “<b className="font-semibold">{q}</b>” as a walk-in <span className="text-muted">— don’t save</span>
          </button>
          <button type="button" onClick={() => setNewOpen(true)}
            className="block w-full border-t border-line px-3 py-2 text-left text-[13px] text-brand hover:bg-field">
            ＋ Save “<b className="font-semibold">{q}</b>” as a new customer
          </button>
        </div>
      )}

      {newOpen && (
        <div className="mt-2 rounded-xl border border-line bg-surface p-3">
          <p className="mb-2 text-[12.5px] font-medium">New customer · <b>{q}</b></p>
          <div className="grid grid-cols-2 gap-2">
            <input className="h-10 rounded-lg bg-field px-2.5 text-[13.5px] text-ink outline-none" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="h-10 rounded-lg bg-field px-2.5 text-[13.5px] text-ink outline-none" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setNewOpen(false)} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink">Back</button>
            <button type="button" onClick={() => emit({ kind: 'new', name: q, email, phone })} className="rounded-full bg-brand px-3.5 py-1.5 text-[12.5px] font-bold text-on-brand">Add customer</button>
          </div>
        </div>
      )}
    </div>
  );
}
