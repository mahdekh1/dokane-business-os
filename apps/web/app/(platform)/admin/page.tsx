'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import type { BusinessDto } from '@dokane/contracts';
import { api } from '../../../src/lib/api';

const pill: Record<string, CSSProperties> = {
  APPROVED: { background: 'rgba(14,106,87,.12)', color: '#0E6A57' },
  PENDING_APPROVAL: { background: 'rgba(217,142,75,.18)', color: '#95571b' },
  CHANGES_REQUESTED: { background: 'rgba(217,142,75,.18)', color: '#95571b' },
  SUSPENDED: { background: 'rgba(163,50,50,.14)', color: '#a33232' },
  REJECTED: { background: 'rgba(120,116,108,.16)', color: '#6F6A60' },
};
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const initials = (s: string) => s.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export default function AdminOverviewPage() {
  const [rows, setRows] = useState<BusinessDto[] | null>(null);

  const reload = useCallback(async () => {
    setRows(await api.platform.list());
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  async function approve(id: string) {
    await api.platform.approve(id);
    await reload();
  }

  if (!rows) return <p className="text-[14px] text-muted">Loading…</p>;

  const count = (s: string) => rows.filter((b) => b.status === s).length;
  const pending = rows.filter((b) => b.status === 'PENDING_APPROVAL' || b.status === 'CHANGES_REQUESTED');
  const metrics = [
    { label: 'Total businesses', value: rows.length },
    { label: 'Pending approval', value: pending.length },
    { label: 'Active', value: count('APPROVED') },
    { label: 'Suspended', value: count('SUSPENDED') },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[24px] font-bold tracking-tight">Platform overview</h1>
        <p className="mt-1 text-[13.5px] text-muted">Businesses, approvals, and health across the platform.</p>
      </div>

      <div className="mb-[18px] grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-[18px]">
            <span className="text-[13px] text-muted">{m.label}</span>
            <b className="text-[26px] font-bold tracking-tight tabular-nums">{m.value}</b>
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <section className="mb-4 rounded-2xl border border-line bg-surface p-[18px]">
          <b className="text-[15px] font-semibold">Pending applications</b>
          <div className="mt-1.5">
            {pending.map((b, i) => (
              <div key={b.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <div>
                  <b className="text-[14px] font-semibold">{b.name}</b>
                  <span className="mt-0.5 block text-[12.5px] text-muted">{b.businessType ?? '—'} · dokane.com/{b.slug}</span>
                </div>
                <span className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold" style={pill[b.status]}>{label(b.status)}</span>
                <span className="flex gap-2">
                  <button onClick={() => approve(b.id)} className="rounded-[9px] bg-brand px-3 py-2 text-[12.5px] font-semibold text-on-brand hover:bg-brand-2">Approve</button>
                  <Link href={`/admin/businesses/${b.id}`} className="rounded-[9px] border border-line px-3 py-2 text-[12.5px] font-semibold text-ink">Review</Link>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-[18px]">
        <div className="mb-1.5 flex items-center justify-between">
          <b className="text-[15px] font-semibold">Businesses</b>
          <span className="text-[12px] text-muted">{rows.length} total</span>
        </div>
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="text-[11.5px] uppercase tracking-[.08em] text-muted">
              <th className="pb-2.5 text-left font-semibold">Business</th>
              <th className="pb-2.5 text-left font-semibold">Type</th>
              <th className="pb-2.5 text-left font-semibold">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td className="border-t border-line py-3">
                  <span className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-[10px] font-bold text-on-brand">{initials(b.name)}</span>
                    <b className="font-semibold">{b.name}</b>
                  </span>
                </td>
                <td className="border-t border-line py-3">{b.businessType ?? '—'}</td>
                <td className="border-t border-line py-3">
                  <span className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold" style={pill[b.status]}>{label(b.status)}</span>
                </td>
                <td className="border-t border-line py-3 text-right">
                  <Link href={`/admin/businesses/${b.id}`} className="font-semibold text-brand hover:underline">Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
