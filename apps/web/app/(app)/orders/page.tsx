'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ChannelDto, OrderListResult } from '@dokane/contracts';
import { FULFILLMENT_STATUSES, PAYMENT_STATUSES, fulfillmentStatusLabel, paymentStatusLabel } from '@dokane/contracts';
import { api } from '../../../src/lib/api';
import { money, shortWhen } from '../../../src/lib/format';
import { FulfillmentChip, PaymentChip } from '../../../src/components/orders/chips';

export default function OrdersPage() {
  const [data, setData] = useState<OrderListResult | null>(null);
  const [channels, setChannels] = useState<ChannelDto[]>([]);
  const [channelId, setChannelId] = useState('');
  const [fulfillment, setFulfillment] = useState('');
  const [payment, setPayment] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setData(await api.orders.list({
      channelId: channelId || undefined,
      fulfillmentStatus: fulfillment || undefined,
      paymentStatus: payment || undefined,
      page,
      pageSize: 20,
    }));
  }, [channelId, fulfillment, payment, page]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void api.channels.list().then(setChannels).catch(() => undefined); }, []);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const sel = 'h-10 rounded-xl bg-field px-3 text-[13.5px] text-ink outline-none';

  return (
    <div className="max-w-[960px]">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Orders</h1>
          <p className="mt-1 text-[13.5px] text-muted">Every sale — in-store, online and manual.</p>
        </div>
        <Link href="/orders/new" className="rounded-full bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-on-brand hover:bg-brand-2">+ New order</Link>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap gap-2.5 border-b border-line p-3.5">
          <select className={sel} value={channelId} onChange={(e) => { setPage(1); setChannelId(e.target.value); }}>
            <option value="">All channels</option>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className={sel} value={fulfillment} onChange={(e) => { setPage(1); setFulfillment(e.target.value); }}>
            <option value="">All fulfillment</option>
            {FULFILLMENT_STATUSES.map((s) => <option key={s} value={s}>{fulfillmentStatusLabel(s)}</option>)}
          </select>
          <select className={sel} value={payment} onChange={(e) => { setPage(1); setPayment(e.target.value); }}>
            <option value="">All payment</option>
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{paymentStatusLabel(s)}</option>)}
          </select>
        </div>

        {!data ? (
          <p className="p-6 text-[14px] text-muted">Loading…</p>
        ) : data.items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[15px] font-semibold">No orders yet</p>
            <p className="mx-auto mt-1 max-w-[42ch] text-[13.5px] text-muted">Ring up a counter sale or take an order — it’ll show here with its fulfillment and payment status.</p>
            <Link href="/orders/new" className="mt-4 inline-flex rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-on-brand">+ New order</Link>
          </div>
        ) : (
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[.06em] text-muted">
                <th className="px-4 py-2.5 text-left font-semibold">Order</th>
                <th className="px-4 py-2.5 text-left font-semibold">Channel</th>
                <th className="px-4 py-2.5 text-left font-semibold">Fulfillment</th>
                <th className="px-4 py-2.5 text-left font-semibold">Payment</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                <th className="px-4 py-2.5 text-right font-semibold">Due</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-field/40">
                  <td className="border-t border-line px-4 py-3">
                    <Link href={`/orders/${o.id}`} className="block">
                      <b className="font-semibold text-brand">#{o.id.slice(0, 8)}</b>
                      <span className="block text-[12px] text-muted">{o.itemCount} item{o.itemCount === 1 ? '' : 's'} · {shortWhen(o.createdAt)}</span>
                    </Link>
                  </td>
                  <td className="border-t border-line px-4 py-3">
                    <span className="rounded-full bg-field px-2.5 py-[3px] text-[11px] font-semibold text-muted">{o.channelName}</span>
                  </td>
                  <td className="border-t border-line px-4 py-3"><FulfillmentChip status={o.fulfillmentStatus} /></td>
                  <td className="border-t border-line px-4 py-3"><PaymentChip status={o.paymentStatus} /></td>
                  <td className="border-t border-line px-4 py-3 text-right tabular-nums font-semibold">{money(o.total, o.currency)}</td>
                  <td className="border-t border-line px-4 py-3 text-right tabular-nums" style={{ color: o.amountDue > 0 ? '#e6ad74' : 'var(--muted)' }}>
                    {o.amountDue > 0 ? money(o.amountDue, o.currency) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
          <span>{data.total} order{data.total === 1 ? '' : 's'}</span>
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
