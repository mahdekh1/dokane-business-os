'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PlanSummary } from '@dokane/contracts';
import { Icon, type IconName } from '../../../src/components/icons';
import { api, ApiError, type ModuleView } from '../../../src/lib/api';

const INFO: Record<string, { desc: string; icon: IconName }> = {
  online_store: { desc: 'Sell online with a mini-site and WhatsApp orders.', icon: 'store' },
  catalog: { desc: 'Products and services, with variants.', icon: 'catalog' },
  inventory: { desc: 'Stock by location with low-stock alerts.', icon: 'inventory' },
  crm: { desc: 'Leads and customers, with source tracking.', icon: 'crm' },
  accounting: { desc: 'Income, expenses and receivables.', icon: 'accounting' },
  project_management: { desc: 'Projects and tasks for your team.', icon: 'projects' },
  mini_site: { desc: 'Your public pages and SEO.', icon: 'globe' },
  channels: { desc: 'Store, in-store and future marketplace channels.', icon: 'store' },
  notifications: { desc: 'WhatsApp and email messages to customers.', icon: 'bell' },
  calendar: { desc: 'Appointments and sessions; sync Google or Apple Calendar.', icon: 'calendar' },
  ai: { desc: 'Ask about your business; draft content.', icon: 'ai' },
};
const info = (id: string) => INFO[id] ?? { desc: '', icon: 'catalog' as IconName };

export default function ModulesPage() {
  const [modules, setModules] = useState<ModuleView[] | null>(null);
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([api.modules(), api.plan()]);
    setModules(m);
    setPlan(p);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function enable(id: string) {
    setError('');
    try {
      await api.enableModule(id);
      // reload so the sidebar nav reflects the newly enabled module too
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not enable that module.');
    }
  }

  if (!modules || !plan) return <p className="text-[14px] text-muted">Loading…</p>;

  const active = modules.filter((m) => m.state === 'active');
  // Suggested-for-this-category modules float to the top of "Available".
  const available = modules
    .filter((m) => m.state === 'available')
    .sort((a, b) => Number(b.suggested) - Number(a.suggested));
  const locked = modules.filter((m) => m.state === 'locked');
  const suggestedCount = available.filter((m) => m.suggested).length;

  return (
    <div className="max-w-[900px]">
      <div className="mb-1.5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Modules</h1>
          <p className="mt-1 text-[13.5px] text-muted">Turn on what your business needs. Switch more on as you grow.</p>
        </div>
        <div className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-2.5">
          <div className="leading-tight">
            <b className="text-[14px]">{plan.name}{plan.tier !== 'NONE' ? ' plan' : ''}</b>
            <span className="block text-[12px] text-muted">{active.length} of {modules.length} modules active</span>
          </div>
        </div>
      </div>

      {error && (
        <p className="my-4 rounded-xl border border-[color:var(--accent)] bg-field px-4 py-3 text-[13.5px]" role="alert">{error}</p>
      )}

      <Section title="Active" items={active} render={(m) => <ModuleCard m={m} action={<button className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink">Manage</button>} />} />
      <Section
        title="Available on your plan"
        subtitle={suggestedCount > 0 ? 'Highlighted modules are suggested for your business type.' : undefined}
        items={available}
        render={(m) => (
          <ModuleCard m={m} action={<button onClick={() => enable(m.id)} className="rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-on-brand hover:bg-brand-2">Enable</button>} />
        )}
      />
      <Section title="Unlock with a higher plan" items={locked} render={(m) => (
        <ModuleCard m={m} locked action={<span className="text-[12.5px] font-semibold text-muted">Upgrade to unlock</span>} />
      )} />
    </div>
  );
}

function Section({ title, subtitle, items, render }: { title: string; subtitle?: string; items: ModuleView[]; render: (m: ModuleView) => React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-[12px] font-semibold uppercase tracking-[.1em] text-muted">{title}</h2>
      {subtitle && <p className="mt-1 text-[12.5px] text-muted">{subtitle}</p>}
      <div className="mb-3" />
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {items.map((m) => render(m))}
      </div>
    </section>
  );
}

function ModuleCard({ m, action, locked }: { m: ModuleView; action: React.ReactNode; locked?: boolean }) {
  const meta = info(m.id);
  const C = Icon[meta.icon];
  const badge =
    m.state === 'active'
      ? { text: 'Active', style: { background: 'rgba(14,106,87,.12)', color: '#0E6A57' } }
      : m.state === 'available'
        ? { text: 'Available', style: { background: 'rgba(217,142,75,.16)', color: '#95571b' } }
        : { text: 'Locked', style: { background: 'rgba(120,116,108,.16)', color: '#6F6A60' } };
  const highlight = m.suggested && m.state === 'available';
  return (
    <div
      className={`flex min-h-[150px] flex-col rounded-2xl border bg-surface p-[18px] ${locked ? 'opacity-70' : ''} ${highlight ? 'border-brand' : 'border-line'}`}
      style={highlight ? { boxShadow: '0 0 0 1px var(--brand) inset' } : undefined}
    >
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="grid h-[38px] w-[38px] place-items-center rounded-[11px] text-brand" style={{ background: 'rgba(14,106,87,.10)' }}><C /></span>
        <span className="text-[15px] font-semibold">{m.name}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {m.suggested && m.state === 'available' && (
            <span className="rounded-full px-2.5 py-[3px] text-[10.5px] font-bold uppercase tracking-[.04em]" style={{ background: 'rgba(14,106,87,.12)', color: '#0E6A57' }}>Suggested</span>
          )}
          <span className="rounded-full px-2.5 py-[3px] text-[10.5px] font-bold uppercase tracking-[.04em]" style={badge.style}>{badge.text}</span>
        </span>
      </div>
      <p className="mb-3.5 text-[13px] leading-[1.55] text-muted">{meta.desc}</p>
      <div className="mt-auto">{action}</div>
    </div>
  );
}
