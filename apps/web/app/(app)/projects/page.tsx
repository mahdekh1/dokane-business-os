'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ProjectListResult } from '@dokane/contracts';
import { projectStatusLabel } from '@dokane/contracts';
import { api, ApiError } from '../../../src/lib/api';
import { shortWhen } from '../../../src/lib/format';

const STATUS_TONE: Record<string, { background: string; color: string }> = {
  PLANNING: { background: 'var(--field)', color: 'var(--muted)' },
  ACTIVE: { background: 'rgba(18,144,122,.16)', color: '#5fd3b6' },
  ON_HOLD: { background: 'rgba(224,167,94,.16)', color: '#e6ad74' },
  COMPLETED: { background: 'rgba(120,150,210,.18)', color: '#a9c0ef' },
  CANCELLED: { background: 'var(--field)', color: 'var(--muted)' },
  ARCHIVED: { background: 'var(--field)', color: 'var(--muted)' },
};

export default function ProjectsPage() {
  const [data, setData] = useState<ProjectListResult | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => { setData(await api.pm.projects.list({ pageSize: 100 })); }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="max-w-[900px]">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-[13.5px] text-muted">Plan work and track tasks across your team.</p>
        </div>
        <button onClick={() => setAdding(true)} className="rounded-full bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-on-brand hover:bg-brand-2">+ New project</button>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface">
        {!data ? (
          <p className="p-6 text-[14px] text-muted">Loading…</p>
        ) : data.items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[15px] font-semibold">No projects yet</p>
            <p className="mx-auto mt-1 max-w-[42ch] text-[13.5px] text-muted">Create a project, then add tasks and assign them to your team.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[.06em] text-muted">
                <th className="px-4 py-2.5 text-left font-semibold">Project</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-left font-semibold">Tasks</th>
                <th className="px-4 py-2.5 text-left font-semibold">Owner</th>
                <th className="px-4 py-2.5 text-left font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className="hover:bg-field/40">
                  <td className="border-t border-line px-4 py-3"><Link href={`/projects/${p.id}`} className="font-semibold text-brand hover:underline">{p.name}</Link>{p.description && <span className="block max-w-[46ch] truncate text-[12px] text-muted">{p.description}</span>}</td>
                  <td className="border-t border-line px-4 py-3"><span className="rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={STATUS_TONE[p.status]}>{projectStatusLabel(p.status)}</span></td>
                  <td className="border-t border-line px-4 py-3 tabular-nums text-muted">{p.openTaskCount} open <span className="text-[12px]">/ {p.taskCount}</span></td>
                  <td className="border-t border-line px-4 py-3 text-muted">{p.ownerName ?? '—'}</td>
                  <td className="border-t border-line px-4 py-3 text-muted tabular-nums">{shortWhen(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adding && <AddProjectDialog onClose={() => setAdding(false)} onDone={() => { setAdding(false); void load(); }} />}
    </div>
  );
}

function AddProjectDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (!name.trim()) { setError('Give the project a name.'); return; }
    setBusy(true);
    try {
      await api.pm.projects.create({ name: name.trim(), description: description.trim() || undefined });
      onDone();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not create the project.'); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-[400px] rounded-2xl border border-line bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[17px] font-bold tracking-tight">New project</h2>
        {error && <p className="mt-3 rounded-xl border border-[color:var(--accent)] bg-field px-3.5 py-2.5 text-[13px]" role="alert">{error}</p>}
        <label className="mb-1 mt-4 block text-[12.5px] font-medium">Name</label>
        <input className="h-11 w-full rounded-[11px] bg-field px-3 text-[14px] text-ink outline-none focus:ring-1 focus:ring-brand" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <label className="mb-1 mt-3 block text-[12.5px] font-medium">Description <span className="font-normal text-muted">(optional)</span></label>
        <textarea className="min-h-[72px] w-full rounded-[11px] bg-field px-3 py-2.5 text-[14px] text-ink outline-none focus:ring-1 focus:ring-brand" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Cancel</button>
          <button type="button" onClick={submit} disabled={busy} className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">{busy ? 'Creating…' : 'Create project'}</button>
        </div>
      </div>
    </div>
  );
}
