'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { CustomerDto, OrderListResult } from '@dokane/contracts';
import { api } from '../../../../../src/lib/api';
import { money, shortWhen } from '../../../../../src/lib/format';
import { FulfillmentChip, PaymentChip } from '../../../../../src/components/orders/chips';

export default function CustomerDetailPage() {
  const id = useParams().id as string;
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [orders, setOrders] = useState<OrderListResult | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [c, o] = await Promise.all([api.customers.get(id), api.orders.list({ customerId: id, pageSize: 50 })]);
      setCustomer(c); setOrders(o);
    } catch { setError('Could not load this customer.'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <p className="text-[14px] text-muted">{error}</p>;
  if (!customer || !orders) return <p className="text-[14px] text-muted">Loading…</p>;

  const cur = orders.items[0]?.currency ?? 'USD';
  const totalSpent = orders.items.reduce((s, o) => s + (o.total - o.amountDue), 0);
  const outstanding = orders.items.reduce((s, o) => s + o.amountDue, 0);

  return (
    <div className="max-w-[880px]">
      <p className="mb-2 text-[12.5px] text-muted"><Link href="/crm/customers" className="hover:underline">Customers</Link> / <span className="font-medium text-ink">{customer.name}</span></p>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand/15 text-[18px] font-bold text-brand">{customer.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">{customer.name}</h1>
            <p className="mt-0.5 text-[13px] text-muted">
              {[customer.email, customer.phone].filter(Boolean).join(' · ') || 'No contact details'}
            </p>
          </div>
        </div>
        <Link href="/orders/new" className="rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold text-ink hover:border-line-strong">+ New order</Link>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3.5">
        <Tile label="Orders" value={String(orders.total)} />
        <Tile label="Total spent" value={money(totalSpent, cur)} tone="good" />
        <Tile label="Outstanding" value={money(outstanding, cur)} tone={outstanding > 0 ? 'warn' : undefined} />
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-3 text-[11px] font-bold uppercase tracking-[.05em] text-muted">Order history</div>
        {orders.items.length === 0 ? (
          <p className="p-6 text-[13.5px] text-muted">No orders yet.</p>
        ) : (
          <table className="w-full border-collapse text-[13.5px]">
            <tbody>
              {orders.items.map((o) => (
                <tr key={o.id} className="hover:bg-field/40">
                  <td className="border-t border-line px-5 py-3"><Link href={`/orders/${o.id}`} className="font-semibold text-brand hover:underline">#{o.id.slice(0, 8)}</Link><span className="ml-2 text-[12px] text-muted">{shortWhen(o.createdAt)}</span></td>
                  <td className="border-t border-line px-3 py-3"><FulfillmentChip status={o.fulfillmentStatus} /></td>
                  <td className="border-t border-line px-3 py-3"><PaymentChip status={o.paymentStatus} /></td>
                  <td className="border-t border-line px-5 py-3 text-right tabular-nums font-semibold">{money(o.total, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  const color = tone === 'good' ? '#5fd3b6' : tone === 'warn' ? '#e6ad74' : 'var(--ink)';
  return (
    <div className="rounded-2xl border border-line bg-surface p-[18px]">
      <div className="text-[11.5px] font-bold uppercase tracking-[.05em] text-muted">{label}</div>
      <div className="mt-2 text-[22px] font-bold tracking-tight tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}
