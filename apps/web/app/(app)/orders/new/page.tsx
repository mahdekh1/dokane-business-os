'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ChannelDto, OfferingDto, OrderCustomerInput } from '@dokane/contracts';
import { api, ApiError } from '../../../../src/lib/api';
import { money, toMinor } from '../../../../src/lib/format';
import { CustomerPicker } from '../../../../src/components/orders/customer-picker';

interface Option { key: string; label: string; offeringId?: string; variantId?: string; unitPrice: number }
interface Line extends Option { quantity: number }

export default function NewOrderPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<ChannelDto[]>([]);
  const [channelId, setChannelId] = useState('');
  const [offerings, setOfferings] = useState<OfferingDto[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<OrderCustomerInput | undefined>();
  const [discount, setDiscount] = useState('');
  const [manualStatus, setManualStatus] = useState<'CONFIRMED' | 'COMPLETED'>('COMPLETED');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.channels.list().then((cs) => {
      setChannels(cs);
      const def = cs.find((c) => c.isDefault) ?? cs[0];
      if (def) setChannelId(def.id);
    }).catch(() => undefined);
    void api.catalog.list({ pageSize: 100 }).then((r) => setOfferings(r.items)).catch(() => undefined);
  }, []);

  const channel = channels.find((c) => c.id === channelId);
  const isOnline = channel?.type === 'ONLINE_STORE';

  const options = useMemo<Option[]>(() => {
    const out: Option[] = [];
    for (const o of offerings) {
      if (o.variants.length > 0) {
        for (const v of o.variants) {
          out.push({ key: `v:${v.id}`, variantId: v.id, unitPrice: v.price, label: `${o.name} — ${v.name ?? Object.values(v.attributes).join(' / ')}` });
        }
      } else {
        out.push({ key: `o:${o.id}`, offeringId: o.id, unitPrice: o.price, label: o.name });
      }
    }
    return out;
  }, [offerings]);

  const addOption = (key: string) => {
    const opt = options.find((o) => o.key === key);
    if (!opt) return;
    setLines((ls) => {
      const i = ls.findIndex((l) => l.key === key);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, quantity: l.quantity + 1 } : l));
      return [...ls, { ...opt, quantity: 1 }];
    });
  };
  const setQty = (key: string, q: number) => setLines((ls) => ls.flatMap((l) => (l.key === key ? (q <= 0 ? [] : [{ ...l, quantity: q }]) : [l])));

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const discountMinor = Math.min(toMinor(discount), subtotal);
  const total = Math.max(0, subtotal - discountMinor);

  async function submit() {
    setError('');
    if (lines.length === 0) { setError('Add at least one product.'); return; }
    setBusy(true);
    try {
      const order = await api.orders.create({
        channelId,
        items: lines.map((l) => ({ offeringId: l.offeringId, variantId: l.variantId, quantity: l.quantity, discount: 0 })),
        discount: discountMinor,
        customer,
        fulfillmentStatus: isOnline ? undefined : manualStatus,
      });
      router.push(`/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the order.');
      setBusy(false);
    }
  }

  const seg = (on: boolean) => `rounded-[9px] px-4 py-2 text-[13px] font-semibold ${on ? '' : 'text-muted'}`;
  const segStyle = (on: boolean) => (on ? { background: 'var(--brand)', color: 'var(--on-brand)' } : undefined);

  return (
    <div className="max-w-[860px]">
      <p className="mb-2 text-[12.5px] text-muted">Orders / <span className="font-medium text-ink">New order</span></p>
      <h1 className="text-[24px] font-bold tracking-tight">New order</h1>
      <p className="mt-1 text-[13.5px] text-muted">Pick products — the server computes every total.</p>

      {error && <p className="mt-4 rounded-xl border border-[color:var(--accent)] bg-field px-4 py-3 text-[13.5px]" role="alert">{error}</p>}

      <div className="mt-5 grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <label className="mb-1.5 block text-[13px] font-medium">Channel</label>
          <div className="inline-flex flex-wrap rounded-[11px] bg-field p-[3px]">
            {channels.map((c) => (
              <button key={c.id} type="button" onClick={() => setChannelId(c.id)} className={seg(c.id === channelId)} style={segStyle(c.id === channelId)}>{c.name}</button>
            ))}
          </div>

          <label className="mb-1.5 mt-5 block text-[13px] font-medium">Add product</label>
          <select className="h-11 w-full rounded-xl bg-field px-3 text-[14px] text-ink outline-none"
            value="" onChange={(e) => { if (e.target.value) addOption(e.target.value); }}>
            <option value="">Choose a product…</option>
            {options.map((o) => <option key={o.key} value={o.key}>{o.label} · {money(o.unitPrice)}</option>)}
          </select>

          {lines.length > 0 && (
            <table className="mt-4 w-full border-collapse text-[13.5px]">
              <thead><tr className="text-[11px] uppercase tracking-[.05em] text-muted"><th className="pb-1.5 text-left font-semibold">Item</th><th className="pb-1.5 text-center font-semibold">Qty</th><th className="pb-1.5 text-right font-semibold">Line</th><th></th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key}>
                    <td className="border-t border-line py-2.5 pr-2"><b className="font-medium">{l.label}</b><span className="block text-[12px] text-muted tabular-nums">{money(l.unitPrice)}</span></td>
                    <td className="border-t border-line py-2.5 text-center">
                      <span className="inline-flex items-center gap-1.5">
                        <button onClick={() => setQty(l.key, l.quantity - 1)} className="grid h-6 w-6 place-items-center rounded-md bg-field text-muted">−</button>
                        <span className="w-6 text-center tabular-nums">{l.quantity}</span>
                        <button onClick={() => setQty(l.key, l.quantity + 1)} className="grid h-6 w-6 place-items-center rounded-md bg-field text-muted">+</button>
                      </span>
                    </td>
                    <td className="border-t border-line py-2.5 text-right tabular-nums">{money(l.unitPrice * l.quantity)}</td>
                    <td className="border-t border-line py-2.5 text-right"><button onClick={() => setQty(l.key, 0)} className="text-[12px] text-muted hover:text-ink">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <label className="mb-1.5 block text-[13px] font-medium">Customer <span className="font-normal text-muted">(optional)</span></label>
          <CustomerPicker onChange={setCustomer} />

          {isOnline ? (
            <p className="mt-4 rounded-lg bg-field px-3 py-2 text-[12.5px] text-muted">Online orders start as <b className="text-ink">Pending</b> and move through the flow after placement.</p>
          ) : (
            <>
              <label className="mb-1.5 mt-4 block text-[13px] font-medium">Create as</label>
              <div className="inline-flex rounded-[11px] bg-field p-[3px]">
                <button type="button" onClick={() => setManualStatus('CONFIRMED')} className={seg(manualStatus === 'CONFIRMED')} style={segStyle(manualStatus === 'CONFIRMED')}>Confirmed</button>
                <button type="button" onClick={() => setManualStatus('COMPLETED')} className={seg(manualStatus === 'COMPLETED')} style={segStyle(manualStatus === 'COMPLETED')}>Completed</button>
              </div>
              {manualStatus === 'COMPLETED' && <p className="mt-1.5 text-[12px] text-muted">A counter sale — stock is deducted on creation.</p>}
            </>
          )}

          <div className="mt-4 border-t border-line pt-3">
            <div className="flex items-center justify-between py-1 text-[13.5px]"><span className="text-muted">Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
            <div className="flex items-center justify-between py-1 text-[13.5px]">
              <span className="text-muted">Discount</span>
              <span className="inline-flex h-8 w-[92px] items-center rounded-lg bg-field px-2"><span className="mr-1 text-[12px] text-muted">−</span><input className="w-full bg-transparent text-right text-[13px] text-ink outline-none tabular-nums" inputMode="decimal" placeholder="0.00" value={discount} onChange={(e) => setDiscount(e.target.value)} /></span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-line pt-2.5 text-[15px] font-bold"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
          </div>

          <div className="mt-5 flex justify-end gap-2.5">
            <button type="button" onClick={() => router.push('/orders')} className="rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Cancel</button>
            <button type="button" onClick={submit} disabled={busy || lines.length === 0} className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">{busy ? 'Creating…' : 'Create order'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
