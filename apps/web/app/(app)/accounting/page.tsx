'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AccountingSummaryDto, ChannelDto, FinancialEntryListResult, ReceivablesResult } from '@dokane/contracts';
import { api, ApiError } from '../../../src/lib/api';
import { money, toMinor, shortWhen, currencySymbol } from '../../../src/lib/format';

export default function AccountingPage() {
  const [channelId, setChannelId] = useState('');
  const [channels, setChannels] = useState<ChannelDto[]>([]);
  const [summary, setSummary] = useState<AccountingSummaryDto | null>(null);
  const [receivables, setReceivables] = useState<ReceivablesResult | null>(null);
  const [entries, setEntries] = useState<FinancialEntryListResult | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const load = useCallback(async () => {
    const [s, r, e] = await Promise.all([
      api.accounting.summary({ channelId: channelId || undefined }),
      api.accounting.receivables(channelId || undefined),
      api.accounting.entries({ channelId: channelId || undefined, pageSize: 12 }),
    ]);
    setSummary(s); setReceivables(r); setEntries(e);
  }, [channelId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void api.channels.list().then(setChannels).catch(() => undefined); }, []);

  const cur = summary?.currency ?? 'USD';
  const expensePct = summary && summary.income > 0 ? Math.min(100, Math.round((summary.expenses / summary.income) * 100)) : 0;

  return (
    <div className="max-w-[960px]">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Accounting</h1>
          <p className="mt-1 text-[13.5px] text-muted">Cash-basis: income follows payments, not just completed sales.</p>
        </div>
        <div className="flex gap-2.5">
          <select className="h-10 rounded-xl bg-field px-3 text-[13.5px] text-ink outline-none" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            <option value="">All channels</option>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setExpenseOpen(true)} className="rounded-full border border-line px-4 py-2.5 text-[13.5px] font-semibold text-ink hover:border-line-strong">+ Record expense</button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Tile label="Sales" value={summary ? money(summary.sales, cur) : '—'} sub="value of completed orders" />
        <Tile label="Income" value={summary ? money(summary.income, cur) : '—'} sub="cash collected" tone="good" />
        <Tile label="Receivables" value={summary ? money(summary.receivables, cur) : '—'} sub={receivables ? `outstanding on ${receivables.items.length} order${receivables.items.length === 1 ? '' : 's'}` : ''} tone="warn" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[.05em] text-muted">Income vs expense</div>
          {summary && (
            <>
              <div className="flex items-center justify-between text-[13px]"><span className="text-muted">Income</span><span className="tabular-nums font-semibold">{money(summary.income, cur)}</span></div>
              <div className="mt-1.5 h-2 rounded-full bg-field"><div className="h-2 rounded-full" style={{ width: '100%', background: 'var(--brand)' }} /></div>
              <div className="mt-3 flex items-center justify-between text-[13px]"><span className="text-muted">Expenses</span><span className="tabular-nums font-semibold">{money(summary.expenses, cur)}</span></div>
              <div className="mt-1.5 h-2 rounded-full bg-field"><div className="h-2 rounded-full" style={{ width: `${expensePct}%`, background: 'var(--accent)' }} /></div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[14px] font-bold"><span>Net</span><span className="tabular-nums" style={{ color: summary.net >= 0 ? '#5fd3b6' : '#e08b7a' }}>{money(summary.net, cur)}</span></div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[.05em] text-muted">Receivables</div>
          {!receivables ? <p className="text-[13px] text-muted">Loading…</p> : receivables.items.length === 0 ? (
            <p className="py-3 text-[13px] text-muted">Nothing outstanding — every order is paid.</p>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead><tr className="text-[11px] uppercase tracking-[.05em] text-muted"><th className="pb-1.5 text-left font-semibold">Order</th><th className="pb-1.5 text-left font-semibold">Customer</th><th className="pb-1.5 text-right font-semibold">Due</th></tr></thead>
              <tbody>
                {receivables.items.map((r) => (
                  <tr key={r.orderId}>
                    <td className="border-t border-line py-2"><Link href={`/orders/${r.orderId}`} className="font-semibold text-brand hover:underline">#{r.orderId.slice(0, 8)}</Link></td>
                    <td className="border-t border-line py-2 text-muted">{r.customerName ?? 'Walk-in'}</td>
                    <td className="border-t border-line py-2 text-right tabular-nums" style={{ color: '#e6ad74' }}>{money(r.amountDue, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-3 text-[11px] font-bold uppercase tracking-[.05em] text-muted">Ledger</div>
        {!entries ? <p className="p-5 text-[13px] text-muted">Loading…</p> : entries.items.length === 0 ? (
          <p className="p-5 text-[13px] text-muted">No entries yet. Income posts automatically when a payment is recorded.</p>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {entries.items.map((e) => (
                <tr key={e.id}>
                  <td className="border-t border-line px-5 py-2.5 text-muted whitespace-nowrap tabular-nums">{shortWhen(e.entryDate)}</td>
                  <td className="border-t border-line px-3 py-2.5"><b className="font-medium capitalize">{e.category ?? (e.type === 'INCOME' ? 'Income' : 'Expense')}</b>{e.sourceType === 'ORDER_PAYMENT' && <span className="ml-1.5 text-[11px] text-muted">· order payment</span>}</td>
                  <td className="border-t border-line px-5 py-2.5 text-right tabular-nums font-semibold" style={{ color: e.type === 'INCOME' ? '#5fd3b6' : '#e08b7a' }}>
                    {e.type === 'INCOME' ? '+' : '−'}{money(e.amount, e.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {expenseOpen && <ExpenseDialog currency={cur} onClose={() => setExpenseOpen(false)} onDone={() => { setExpenseOpen(false); void load(); }} />}
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'good' | 'warn' }) {
  const color = tone === 'good' ? '#5fd3b6' : tone === 'warn' ? '#e6ad74' : 'var(--ink)';
  return (
    <div className="rounded-2xl border border-line bg-surface p-[18px]">
      <div className="text-[11.5px] font-bold uppercase tracking-[.05em] text-muted">{label}</div>
      <div className="mt-2 text-[27px] font-bold tracking-tight tabular-nums" style={{ color }}>{value}</div>
      <div className="mt-1 text-[12px] text-muted">{sub}</div>
    </div>
  );
}

function ExpenseDialog({ currency, onClose, onDone }: { currency: string; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    const minor = toMinor(amount);
    if (minor <= 0) { setError('Enter an amount.'); return; }
    setBusy(true);
    try {
      await api.accounting.createEntry({ type: 'EXPENSE', amount: minor, category: category.trim() || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the expense.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-[380px] rounded-2xl border border-line bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[17px] font-bold tracking-tight">Record expense</h2>
        {error && <p className="mt-3 rounded-xl border border-[color:var(--accent)] bg-field px-3.5 py-2.5 text-[13px]" role="alert">{error}</p>}
        <label className="mb-1 mt-4 block text-[12.5px] font-medium">Amount</label>
        <div className="flex h-11 items-center rounded-[11px] bg-field px-3">
          <span className="mr-1.5 text-muted">{currencySymbol(currency)}</span>
          <input className="w-full bg-transparent text-[14.5px] text-ink outline-none tabular-nums" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus placeholder="0.00" />
        </div>
        <label className="mb-1 mt-4 block text-[12.5px] font-medium">Category <span className="font-normal text-muted">(optional)</span></label>
        <input className="h-11 w-full rounded-[11px] bg-field px-3 text-[14px] text-ink outline-none" placeholder="e.g. rent, supplies" value={category} onChange={(e) => setCategory(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Cancel</button>
          <button type="button" onClick={submit} disabled={busy} className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">{busy ? 'Saving…' : 'Record expense'}</button>
        </div>
      </div>
    </div>
  );
}
