'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { FulfillmentStatus, OrderDto } from '@dokane/contracts';
import { fulfillmentStatusLabel } from '@dokane/contracts';
import { api, ApiError } from '../../../../src/lib/api';
import { money, shortWhen } from '../../../../src/lib/format';
import { FulfillmentChip, PaymentChip } from '../../../../src/components/orders/chips';
import { PaymentDialog } from '../../../../src/components/orders/payment-dialog';

const PAYMENT_METHOD_LABEL: Record<string, string> = { CASH: 'Cash', BIT: 'Bit' };

export default function OrderDetailPage() {
  const id = useParams().id as string;
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setOrder(await api.orders.get(id)); }
    catch { setError('Could not load this order.'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function transition(status: FulfillmentStatus) {
    setError(''); setBusy(true);
    try { setOrder(await api.orders.transition(id, status)); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not update the order.'); }
    finally { setBusy(false); }
  }

  if (error && !order) return <p className="text-[14px] text-muted">{error}</p>;
  if (!order) return <p className="text-[14px] text-muted">Loading…</p>;

  const cancellable = order.allowedTransitions.includes('CANCELLED');
  const forward = order.allowedTransitions.filter((s) => s !== 'CANCELLED');
  const canPay = order.amountDue > 0 && order.fulfillmentStatus !== 'CANCELLED';

  return (
    <div className="max-w-[860px]">
      <p className="mb-2 text-[12.5px] text-muted"><Link href="/orders" className="hover:underline">Orders</Link> / <span className="font-medium text-ink">#{order.id.slice(0, 8)}</span></p>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Order #{order.id.slice(0, 8)}</h1>
          <p className="mt-1 text-[13px] text-muted">{order.channelName} · {order.customerName ?? 'Walk-in customer'} · {shortWhen(order.createdAt)}</p>
        </div>
        <div className="text-right">
          <div className="text-[22px] font-bold tabular-nums">{money(order.total, order.currency)}</div>
          <div className="mt-1"><PaymentChip status={order.paymentStatus} /></div>
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl border border-[color:var(--accent)] bg-field px-4 py-3 text-[13.5px]" role="alert">{error}</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[.05em] text-muted">Fulfillment</div>
          <div className="mb-3"><FulfillmentChip status={order.fulfillmentStatus} /></div>
          {forward.length > 0 || cancellable ? (
            <div className="flex flex-wrap gap-2">
              {forward.map((s) => (
                <button key={s} disabled={busy} onClick={() => transition(s)} className="rounded-full bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-on-brand hover:bg-brand-2 disabled:opacity-60">
                  → {fulfillmentStatusLabel(s)}
                </button>
              ))}
              {cancellable && (
                <button disabled={busy} onClick={() => transition('CANCELLED')} className="rounded-full border border-line px-3.5 py-1.5 text-[12.5px] font-semibold text-ink hover:border-line-strong disabled:opacity-60">Cancel order</button>
              )}
            </div>
          ) : (
            <p className="text-[12.5px] text-muted">No further steps.</p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[.05em] text-muted">Payment</div>
          {order.payments.length === 0 ? (
            <p className="text-[12.5px] text-muted">No payments yet.</p>
          ) : (
            order.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-t border-line py-2 text-[13px] first:border-t-0">
                <span>{PAYMENT_METHOD_LABEL[p.method] ?? p.method} <span className="text-muted">· {shortWhen(p.receivedAt)}</span></span>
                <span className="tabular-nums">{money(p.amount, p.currency)}</span>
              </div>
            ))
          )}
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[13px] font-semibold" style={{ color: order.amountDue > 0 ? '#e6ad74' : 'var(--muted)' }}>
            <span>Amount due</span><span className="tabular-nums">{money(order.amountDue, order.currency)}</span>
          </div>
          {canPay && (
            <button onClick={() => setPaying(true)} className="mt-3 rounded-full bg-brand px-4 py-2 text-[12.5px] font-bold text-on-brand hover:bg-brand-2">+ Record payment</button>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[.05em] text-muted">Items</div>
        <table className="w-full border-collapse text-[13.5px]">
          <thead><tr className="text-[11px] uppercase tracking-[.05em] text-muted"><th className="pb-1.5 text-left font-semibold">Item</th><th className="pb-1.5 text-center font-semibold">Qty</th><th className="pb-1.5 text-right font-semibold">Unit</th><th className="pb-1.5 text-right font-semibold">Line</th></tr></thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id}>
                <td className="border-t border-line py-2.5"><b className="font-medium">{it.nameSnapshot}</b>{it.skuSnapshot && <span className="block text-[12px] text-muted">{it.skuSnapshot}</span>}</td>
                <td className="border-t border-line py-2.5 text-center tabular-nums">{it.quantity}</td>
                <td className="border-t border-line py-2.5 text-right tabular-nums">{money(it.unitPrice, order.currency)}</td>
                <td className="border-t border-line py-2.5 text-right tabular-nums">{money(it.lineTotal, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 ml-auto max-w-[240px]">
          <div className="flex justify-between py-1 text-[13px]"><span className="text-muted">Subtotal</span><span className="tabular-nums">{money(order.subtotal, order.currency)}</span></div>
          {order.discount > 0 && <div className="flex justify-between py-1 text-[13px]"><span className="text-muted">Discount</span><span className="tabular-nums">−{money(order.discount, order.currency)}</span></div>}
          <div className="flex justify-between border-t border-line pt-2 mt-1 text-[15px] font-bold"><span>Total</span><span className="tabular-nums">{money(order.total, order.currency)}</span></div>
        </div>
      </div>

      {paying && <PaymentDialog order={order} onClose={() => setPaying(false)} onDone={(o) => { setOrder(o); setPaying(false); }} />}
    </div>
  );
}
