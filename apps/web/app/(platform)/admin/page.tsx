const metrics = [
  { label: 'Total businesses', value: '128', note: '+4 this week' },
  { label: 'Pending approval', value: '6', note: 'oldest 2 days' },
  { label: 'Active', value: '112', note: '87% of total' },
  { label: 'Suspended', value: '3', note: 'needs review' },
];

const pending = [
  { name: 'Nour Pharmacy', meta: 'Clinic', when: '2 hours ago' },
  { name: 'Cedar Books', meta: 'Store', when: '5 hours ago' },
  { name: 'Studio Twelve', meta: 'Services', when: 'Yesterday' },
];

const businesses = [
  { name: 'ABC Store', plan: 'Growth', status: 'Approved', when: '12 Aug', tone: 'ok' },
  { name: 'Fashion Store', plan: 'Starter', status: 'Approved', when: '3 Sep', tone: 'ok' },
  { name: 'Nour Pharmacy', plan: '—', status: 'Pending', when: 'Today', tone: 'pend' },
  { name: 'Old Souk Gifts', plan: 'Business', status: 'Suspended', when: '1 Jul', tone: 'sus' },
];

import type { CSSProperties } from 'react';

const pillStyle: Record<string, CSSProperties> = {
  ok: { background: 'rgba(14,106,87,.12)', color: '#0E6A57' },
  pend: { background: 'rgba(217,142,75,.18)', color: '#95571b' },
  sus: { background: 'rgba(163,50,50,.14)', color: '#a33232' },
};

export default function AdminOverviewPage() {
  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Platform overview</h1>
          <p className="mt-1 text-[13.5px] text-muted">Businesses, approvals, and health across the platform.</p>
        </div>
        <span className="rounded-full border border-dashed border-line px-2.5 py-1 text-[11px] uppercase tracking-[.1em] text-muted">
          Sample data
        </span>
      </div>

      <div className="mb-[18px] grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-[18px]">
            <span className="text-[13px] text-muted">{m.label}</span>
            <b className="text-[26px] font-bold tracking-tight">{m.value}</b>
            <span className="text-[12px] text-muted">{m.note}</span>
          </div>
        ))}
      </div>

      <section className="mb-4 rounded-2xl border border-line bg-surface p-[18px]">
        <div className="mb-1.5 flex items-center justify-between">
          <b className="text-[15px] font-semibold">Pending applications</b>
          <a href="/admin/approvals" className="text-[13px] font-medium text-brand hover:underline">View all (6)</a>
        </div>
        {pending.map((p, i) => (
          <div key={p.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3"
            style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
            <div>
              <b className="text-[14px] font-semibold">{p.name}</b>
              <span className="mt-0.5 block text-[12.5px] text-muted">{p.meta}</span>
            </div>
            <span className="text-[12.5px] text-muted">{p.when}</span>
            <span className="flex gap-2">
              <button className="rounded-[9px] border border-line px-3 py-2 text-[12.5px] font-semibold text-ink">Reject</button>
              <button className="rounded-[9px] bg-brand px-3 py-2 text-[12.5px] font-semibold text-on-brand hover:bg-brand-2">Review</button>
            </span>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-[18px]">
        <div className="mb-1.5 flex items-center justify-between">
          <b className="text-[15px] font-semibold">Businesses</b>
          <span className="text-[12px] text-muted">showing 4 of 128</span>
        </div>
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="text-[11.5px] uppercase tracking-[.08em] text-muted">
              <th className="pb-2.5 text-left font-semibold">Business</th>
              <th className="pb-2.5 text-left font-semibold">Plan</th>
              <th className="pb-2.5 text-left font-semibold">Status</th>
              <th className="pb-2.5 text-left font-semibold">Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.name}>
                <td className="border-t border-line py-3 font-semibold">{b.name}</td>
                <td className="border-t border-line py-3">{b.plan}</td>
                <td className="border-t border-line py-3">
                  <span className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold" style={pillStyle[b.tone]}>{b.status}</span>
                </td>
                <td className="border-t border-line py-3 tabular-nums text-muted">{b.when}</td>
                <td className="border-t border-line py-3 text-right">
                  <a href="/admin/businesses" className="font-semibold text-brand hover:underline">Open</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
