'use client';

import { useEffect, useState } from 'react';
import type { OrderDto } from '@dokane/contracts';
import { api, ApiError } from '../../lib/api';
import { money, toMinor, currencySymbol } from '../../lib/format';

export function PaymentDialog({
  order,
  onClose,
  onDone,
}: {
  order: OrderDto;
  onClose: () => void;
  onDone: (o: OrderDto) => void;
}) {
  const [method, setMethod] = useState<'CASH' | 'BIT'>('CASH');
  const [amount, setAmount] = useState((order.amountDue / 100).toFixed(2));
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const minor = toMinor(amount);

  async function submit() {
    setError('');
    if (minor <= 0) { setError('Enter an amount.'); return; }
    if (minor > order.amountDue) { setError(`That's more than the ${money(order.amountDue, order.currency)} due.`); return; }
    setBusy(true);
    try {
      onDone(await api.orders.recordPayment(order.id, { amount: minor, method, reference: reference.trim() || undefined }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the payment.');
      setBusy(false);
    }
  }

  const seg = (on: boolean) => `rounded-[9px] px-4 py-2 text-[12.5px] font-bold ${on ? '' : 'text-muted'}`;
  const segStyle = (on: boolean) => (on ? { background: 'var(--brand)', color: 'var(--on-brand)' } : undefined);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-[400px] rounded-2xl border border-line bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[17px] font-bold tracking-tight">Record payment</h2>
        <p className="mt-0.5 text-[13px] text-muted">Order #{order.id.slice(0, 8)} · {money(order.amountDue, order.currency)} due</p>

        {error && <p className="mt-3 rounded-xl border border-[color:var(--accent)] bg-field px-3.5 py-2.5 text-[13px]" role="alert">{error}</p>}

        <label className="mb-1 mt-4 block text-[12.5px] font-medium">Method</label>
        <div className="inline-flex rounded-[11px] bg-field p-[3px]">
          {(['CASH', 'BIT'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMethod(m)} className={seg(method === m)} style={segStyle(method === m)}>{m === 'CASH' ? 'Cash' : 'Bit'}</button>
          ))}
        </div>

        <label className="mb-1 mt-4 block text-[12.5px] font-medium">Amount</label>
        <div className="flex h-11 items-center rounded-[11px] bg-field px-3">
          <span className="mr-1.5 text-muted">{currencySymbol(order.currency)}</span>
          <input className="w-full bg-transparent text-[14.5px] text-ink outline-none tabular-nums" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>

        <label className="mb-1 mt-4 block text-[12.5px] font-medium">Reference <span className="font-normal text-muted">(optional)</span></label>
        <input className="h-11 w-full rounded-[11px] bg-field px-3 text-[14px] text-ink outline-none" placeholder="e.g. Bit confirmation" value={reference} onChange={(e) => setReference(e.target.value)} />

        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Cancel</button>
          <button type="button" onClick={submit} disabled={busy} className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">
            {busy ? 'Recording…' : `Record ${money(minor > 0 ? minor : 0, order.currency)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
