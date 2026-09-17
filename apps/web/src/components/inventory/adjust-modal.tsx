'use client';

import { useEffect, useState } from 'react';
import type { InventoryItemDto } from '@dokane/contracts';
import { api, ApiError } from '../../lib/api';

/** Identifies the stockable to adjust (exactly one of offeringId / variantId). */
export interface AdjustTarget {
  label: string;
  locationId?: string;
  offeringId: string | null;
  variantId: string | null;
  quantity: number;
  lowStockThreshold: number | null;
}

export function AdjustStockModal({
  target,
  onClose,
  onDone,
}: {
  target: AdjustTarget;
  onClose: () => void;
  onDone: (item: InventoryItemDto) => void;
}) {
  const [dir, setDir] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [threshold, setThreshold] = useState(target.lowStockThreshold?.toString() ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const qty = Math.max(0, Math.round(parseFloat(amount) || 0));
  const delta = dir === 'add' ? qty : -qty;
  const nextQty = target.quantity + delta;

  async function submit() {
    setError('');
    if (qty <= 0) { setError('Enter how many units to add or remove.'); return; }
    if (nextQty < 0) { setError(`Only ${target.quantity} in stock — can’t remove ${qty}.`); return; }
    setBusy(true);
    try {
      const item = await api.inventory.adjust({
        offeringId: target.offeringId ?? undefined,
        variantId: target.variantId ?? undefined,
        locationId: target.locationId,
        delta,
        movementType: 'ADJUSTMENT',
        reason: reason.trim() || undefined,
        lowStockThreshold: threshold.trim() === '' ? undefined : Math.max(0, Math.round(parseFloat(threshold) || 0)),
      });
      onDone(item);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not adjust stock.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-2xl border border-line bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[17px] font-bold tracking-tight">Adjust stock</h2>
        <p className="mt-0.5 text-[13px] text-muted">{target.label}</p>

        {error && <p className="mt-3 rounded-xl border border-[color:var(--accent)] bg-field px-3.5 py-2.5 text-[13px]" role="alert">{error}</p>}

        <div className="mt-4 inline-flex rounded-[11px] bg-field p-[3px]">
          {(['add', 'remove'] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDir(d)}
              className="rounded-[9px] px-4 py-2 text-[13px] font-semibold capitalize"
              style={dir === d ? { background: 'var(--brand)', color: 'var(--on-brand)' } : { color: 'var(--muted)' }}>
              {d === 'add' ? 'Add' : 'Remove'}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12.5px] font-medium mb-1 text-ink">Quantity</label>
            <input className="h-11 w-full rounded-[11px] bg-field px-3 text-[14.5px] text-ink outline-none focus:ring-1 focus:ring-brand"
              inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium mb-1 text-ink">New total</label>
            <div className="grid h-11 place-items-center rounded-[11px] bg-field text-[14.5px] font-semibold tabular-nums"
              style={{ color: nextQty < 0 ? 'var(--accent)' : 'var(--ink)' }}>{nextQty}</div>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-[12.5px] font-medium mb-1 text-ink">Reason <span className="font-normal text-muted">(optional)</span></label>
          <input className="h-11 w-full rounded-[11px] bg-field px-3 text-[14.5px] text-ink outline-none focus:ring-1 focus:ring-brand"
            value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Stock count, damage, restock" />
        </div>

        <div className="mt-3">
          <label className="block text-[12.5px] font-medium mb-1 text-ink">Low-stock alert at <span className="font-normal text-muted">(optional)</span></label>
          <input className="h-11 w-full rounded-[11px] bg-field px-3 text-[14.5px] text-ink outline-none focus:ring-1 focus:ring-brand"
            inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="No alert" />
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Cancel</button>
          <button type="button" onClick={submit} disabled={busy}
            className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">
            {busy ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
