'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { PlatformBusinessDetail } from '@dokane/contracts';
import { api } from '../../../../../src/lib/api';

const pill: Record<string, CSSProperties> = {
  APPROVED: { background: 'rgba(14,106,87,.12)', color: '#0E6A57' },
  PENDING_APPROVAL: { background: 'rgba(217,142,75,.18)', color: '#95571b' },
  CHANGES_REQUESTED: { background: 'rgba(217,142,75,.18)', color: '#95571b' },
  SUSPENDED: { background: 'rgba(163,50,50,.14)', color: '#a33232' },
  REJECTED: { background: 'rgba(120,116,108,.16)', color: '#6F6A60' },
};
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const initials = (s: string) => s.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export default function ReviewBusinessPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [biz, setBiz] = useState<PlatformBusinessDetail | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.platform.get(id).then(setBiz);
  }, [id]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      router.push('/admin');
    } finally {
      setBusy(false);
    }
  }

  if (!biz) return <p className="text-[14px] text-muted">Loading…</p>;

  const canDecide = biz.status === 'PENDING_APPROVAL' || biz.status === 'CHANGES_REQUESTED';
  const rows: [string, string][] = [
    ['Type', biz.businessType ?? '—'],
    ['Business ID', biz.businessNumber ?? '—'],
    ['Address', biz.address ?? '—'],
    ['Phone', biz.phone ?? '—'],
    ['Store URL', `dokane.com/${biz.slug}`],
  ];

  return (
    <div className="max-w-[820px]">
      <Link href="/admin" className="text-[13px] text-muted hover:text-ink">← Businesses</Link>

      <div className="mb-4 mt-3 flex items-center gap-3.5">
        <div className="grid h-[52px] w-[52px] place-items-center rounded-[14px] bg-brand text-[18px] font-bold text-on-brand">{initials(biz.name)}</div>
        <div>
          <h1 className="text-[23px] font-bold tracking-tight">{biz.name}</h1>
          <p className="mt-0.5 text-[13.5px] text-muted">{biz.businessType ?? '—'} · dokane.com/{biz.slug}</p>
        </div>
        <span className="ml-auto rounded-full px-3 py-1 text-[11px] font-semibold" style={pill[biz.status]}>{label(biz.status)}</span>
      </div>

      <div className="mb-4 grid gap-3.5 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-[18px]">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[.08em] text-muted">Business</h3>
          {rows.map(([k, v], i) => (
            <div key={k} className="flex justify-between py-2 text-[13.5px]" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <span className="text-muted">{k}</span><b className="font-medium">{v}</b>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-line bg-surface p-[18px]">
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[.08em] text-muted">Owner</h3>
          <div className="flex justify-between py-2 text-[13.5px]"><span className="text-muted">Name</span><b className="font-medium">{biz.owner?.name ?? '—'}</b></div>
          <div className="flex justify-between py-2 text-[13.5px]" style={{ borderTop: '1px solid var(--border)' }}><span className="text-muted">Email</span><b className="font-medium">{biz.owner?.email ?? '—'}</b></div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-[18px]">
        <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[.08em] text-muted">Decision</h3>
        {canDecide ? (
          <>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note to the owner (shown on request changes / reject)"
              className="min-h-[74px] w-full resize-y rounded-xl border border-transparent bg-field px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand" />
            <div className="mt-3.5 flex flex-wrap gap-2.5">
              <button disabled={busy} onClick={() => act(() => api.platform.approve(biz.id))}
                className="rounded-full bg-brand px-6 py-3 text-[14px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">Approve</button>
              <button disabled={busy} onClick={() => act(() => api.platform.requestChanges(biz.id, note || undefined))}
                className="rounded-full border border-line px-4 py-3 text-[13.5px] font-semibold text-ink disabled:opacity-60">Request changes</button>
              <button disabled={busy} onClick={() => act(() => api.platform.reject(biz.id, note || undefined))}
                className="rounded-full border border-line px-4 py-3 text-[13.5px] font-semibold text-ink disabled:opacity-60">Reject</button>
            </div>
          </>
        ) : biz.status === 'APPROVED' ? (
          <div className="flex items-center justify-between">
            <p className="text-[13.5px] text-muted">This business is active.</p>
            <button disabled={busy} onClick={() => act(() => api.platform.suspend(biz.id, note || undefined))}
              className="rounded-full border border-line px-4 py-3 text-[13.5px] font-semibold text-ink disabled:opacity-60">Suspend</button>
          </div>
        ) : biz.status === 'SUSPENDED' ? (
          <div className="flex items-center justify-between">
            <p className="text-[13.5px] text-muted">This business is suspended.</p>
            <button disabled={busy} onClick={() => act(() => api.platform.reactivate(biz.id))}
              className="rounded-full bg-brand px-5 py-3 text-[13.5px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">Reactivate</button>
          </div>
        ) : (
          <p className="text-[13.5px] text-muted">No actions available for a {label(biz.status).toLowerCase()} business.</p>
        )}
      </div>
    </div>
  );
}
