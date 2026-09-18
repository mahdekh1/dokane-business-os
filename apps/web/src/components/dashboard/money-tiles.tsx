'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AccountingSummaryDto, ChannelDto } from '@dokane/contracts';
import { api } from '../../lib/api';
import { money } from '../../lib/format';

/**
 * Sales / Income / Receivables tiles, global or per-channel. Reads the accounting
 * summary; if the plan isn't entitled to Accounting the call 403s and we show a
 * neutral placeholder instead of an error.
 */
export function MoneyTiles() {
  const [summary, setSummary] = useState<AccountingSummaryDto | null>(null);
  const [channels, setChannels] = useState<ChannelDto[]>([]);
  const [channelId, setChannelId] = useState('');
  const [locked, setLocked] = useState(false);

  const load = useCallback(async () => {
    try { setSummary(await api.accounting.summary({ channelId: channelId || undefined })); }
    catch { setLocked(true); }
  }, [channelId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void api.channels.list().then(setChannels).catch(() => undefined); }, []);

  if (locked) {
    return (
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
        {['Sales', 'Income', 'Receivables'].map((l) => (
          <div key={l} className="flex flex-col gap-1 rounded-2xl border border-dashed border-line bg-surface p-[18px]">
            <span className="text-[13px] text-muted">{l}</span>
            <b className="text-[26px] font-bold tracking-tight text-muted">—</b>
            <span className="text-[12px] text-muted">Add Accounting to your plan</span>
          </div>
        ))}
      </div>
    );
  }

  const cur = summary?.currency ?? 'USD';
  const tiles: { label: string; value: string; sub: string; color?: string }[] = [
    { label: 'Sales', value: summary ? money(summary.sales, cur) : '—', sub: 'completed orders' },
    { label: 'Income', value: summary ? money(summary.income, cur) : '—', sub: 'cash collected', color: '#5fd3b6' },
    { label: 'Receivables', value: summary ? money(summary.receivables, cur) : '—', sub: 'outstanding', color: '#e6ad74' },
  ];

  return (
    <div>
      {channels.length > 1 && (
        <div className="mb-3 inline-flex flex-wrap rounded-[11px] bg-field p-[3px]">
          <button onClick={() => setChannelId('')} className="rounded-[9px] px-3.5 py-1.5 text-[12.5px] font-semibold" style={channelId === '' ? { background: 'var(--brand)', color: 'var(--on-brand)' } : { color: 'var(--muted)' }}>All channels</button>
          {channels.map((c) => (
            <button key={c.id} onClick={() => setChannelId(c.id)} className="rounded-[9px] px-3.5 py-1.5 text-[12.5px] font-semibold" style={channelId === c.id ? { background: 'var(--brand)', color: 'var(--on-brand)' } : { color: 'var(--muted)' }}>{c.name}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-[18px]">
            <span className="text-[12.5px] font-semibold uppercase tracking-[.05em] text-muted">{t.label}</span>
            <b className="text-[26px] font-bold tracking-tight tabular-nums" style={{ color: t.color ?? 'var(--ink)' }}>{t.value}</b>
            <span className="text-[12px] text-muted">{t.sub}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-muted"><Link href="/accounting" className="text-brand hover:underline">Open accounting</Link> for the full ledger and receivables.</p>
    </div>
  );
}
