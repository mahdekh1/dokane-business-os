'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LeadDto } from '@dokane/contracts';
import { LEAD_STAGES, leadStageLabel } from '@dokane/contracts';
import { api, ApiError } from '../../../../src/lib/api';
import { money, toMinor } from '../../../../src/lib/format';

const STAGE_TONE: Record<string, string> = {
  NEW: '#9A948A', CONTACTED: '#a9c0ef', QUALIFIED: '#e6ad74', CONVERTED: '#5fd3b6', LOST: '#e08b7a',
};

export default function PipelinePage() {
  const [leads, setLeads] = useState<LeadDto[] | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLeads((await api.crm.leads.list({ pageSize: 100 })).items);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function setStage(lead: LeadDto, stage: string) {
    const updated = await api.crm.leads.update(lead.id, { stage: stage as LeadDto['stage'] }).catch(() => null);
    if (updated) setLeads((ls) => (ls ?? []).map((l) => (l.id === lead.id ? updated : l)));
  }
  async function convert(lead: LeadDto) {
    const updated = await api.crm.leads.convert(lead.id).catch(() => null);
    if (updated) setLeads((ls) => (ls ?? []).map((l) => (l.id === lead.id ? updated : l)));
  }

  return (
    <div className="max-w-[1080px]">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Pipeline</h1>
          <p className="mt-1 text-[13.5px] text-muted">Track leads from first contact to a converted customer.</p>
        </div>
        <button onClick={() => setAdding(true)} className="rounded-full bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-on-brand hover:bg-brand-2">+ Add lead</button>
      </div>

      {!leads ? (
        <p className="mt-6 text-[14px] text-muted">Loading…</p>
      ) : (
        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
          {LEAD_STAGES.map((stage) => {
            const col = leads.filter((l) => l.stage === stage);
            return (
              <div key={stage} className="w-[220px] flex-none">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[.05em]" style={{ color: STAGE_TONE[stage] }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: STAGE_TONE[stage] }} />{leadStageLabel(stage)}
                  </span>
                  <span className="text-[12px] text-muted">{col.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {col.map((l) => (
                    <div key={l.id} className="rounded-xl border border-line bg-surface p-3">
                      <div className="flex items-start justify-between gap-2">
                        <b className="text-[13.5px] font-semibold">{l.name}</b>
                        {l.value != null && <span className="text-[12px] font-semibold tabular-nums text-muted">{money(l.value)}</span>}
                      </div>
                      {(l.email || l.phone) && <p className="mt-0.5 text-[12px] text-muted">{l.email ?? l.phone}</p>}
                      {l.source && <span className="mt-1.5 inline-block rounded-full bg-field px-2 py-[2px] text-[10.5px] font-semibold text-muted">{l.source}</span>}
                      <div className="mt-2.5 flex items-center gap-1.5">
                        {l.stage !== 'CONVERTED' ? (
                          <>
                            <select value={l.stage} onChange={(e) => void setStage(l, e.target.value)}
                              className="h-7 flex-1 rounded-lg bg-field px-1.5 text-[11.5px] text-ink outline-none">
                              {LEAD_STAGES.filter((s) => s !== 'CONVERTED').map((s) => <option key={s} value={s}>{leadStageLabel(s)}</option>)}
                            </select>
                            <button onClick={() => void convert(l)} className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-on-brand hover:bg-brand-2">Convert</button>
                          </>
                        ) : (
                          <span className="text-[11.5px] font-semibold" style={{ color: STAGE_TONE.CONVERTED }}>✓ Customer</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {col.length === 0 && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-muted">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && <AddLeadDialog onClose={() => setAdding(false)} onDone={() => { setAdding(false); void load(); }} />}
    </div>
  );
}

function AddLeadDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [value, setValue] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (!name.trim()) { setError('Give the lead a name.'); return; }
    setBusy(true);
    try {
      await api.crm.leads.create({
        name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined,
        value: value.trim() ? toMinor(value) : undefined, source: source.trim() || undefined, stage: 'NEW',
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the lead.');
      setBusy(false);
    }
  }

  const inp = 'h-11 w-full rounded-[11px] bg-field px-3 text-[14px] text-ink outline-none focus:ring-1 focus:ring-brand';
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-[400px] rounded-2xl border border-line bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[17px] font-bold tracking-tight">Add lead</h2>
        {error && <p className="mt-3 rounded-xl border border-[color:var(--accent)] bg-field px-3.5 py-2.5 text-[13px]" role="alert">{error}</p>}
        <label className="mb-1 mt-4 block text-[12.5px] font-medium">Name</label>
        <input className={inp} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div><label className="mb-1 block text-[12.5px] font-medium">Email</label><input className={inp} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="mb-1 block text-[12.5px] font-medium">Phone</label><input className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div><label className="mb-1 block text-[12.5px] font-medium">Est. value</label><input className={inp} inputMode="decimal" placeholder="0.00" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div><label className="mb-1 block text-[12.5px] font-medium">Source</label><input className={inp} placeholder="referral, ad…" value={source} onChange={(e) => setSource(e.target.value)} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Cancel</button>
          <button type="button" onClick={submit} disabled={busy} className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">{busy ? 'Adding…' : 'Add lead'}</button>
        </div>
      </div>
    </div>
  );
}
