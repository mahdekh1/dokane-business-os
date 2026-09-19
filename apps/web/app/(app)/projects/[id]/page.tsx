'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ProjectDto, TaskDto, TeamMemberDto } from '@dokane/contracts';
import {
  allowedProjectTransitions, allowedTaskTransitions, projectStatusLabel, taskStatusLabel,
  type ProjectStatus, type TaskStatus,
} from '@dokane/contracts';
import { api, ApiError } from '../../../../src/lib/api';

const BOARD: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'];
const PRIORITY_TONE: Record<string, { background: string; color: string }> = {
  LOW: { background: 'var(--field)', color: 'var(--muted)' },
  MEDIUM: { background: 'rgba(120,150,210,.18)', color: '#a9c0ef' },
  HIGH: { background: 'rgba(224,167,94,.16)', color: '#e6ad74' },
  URGENT: { background: 'rgba(224,139,122,.16)', color: '#e08b7a' },
};
const COL_TONE: Record<string, string> = { TODO: '#9A948A', IN_PROGRESS: '#a9c0ef', IN_REVIEW: '#e6ad74', DONE: '#5fd3b6', BLOCKED: '#e08b7a' };
const due = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function ProjectBoardPage() {
  const id = useParams().id as string;
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [members, setMembers] = useState<TeamMemberDto[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([api.pm.projects.get(id), api.pm.tasks.list({ projectId: id, pageSize: 200 })]);
      setProject(p); setTasks(t.items);
    } catch { setError('Could not load this project.'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void api.team.members().then(setMembers).catch(() => undefined); }, []);

  async function moveProject(status: ProjectStatus) {
    const updated = await api.pm.projects.update(id, { status }).catch(() => null);
    if (updated) setProject(updated);
  }
  async function patchTask(task: TaskDto, patch: Parameters<typeof api.pm.tasks.update>[1]) {
    const updated = await api.pm.tasks.update(task.id, patch).catch(() => null);
    if (updated) { setTasks((ts) => ts.map((t) => (t.id === task.id ? updated : t))); void api.pm.projects.get(id).then(setProject).catch(() => undefined); }
  }

  if (error) return <p className="text-[14px] text-muted">{error}</p>;
  if (!project) return <p className="text-[14px] text-muted">Loading…</p>;

  return (
    <div className="max-w-[1100px]">
      <p className="mb-2 text-[12.5px] text-muted"><Link href="/projects" className="hover:underline">Projects</Link> / <span className="font-medium text-ink">{project.name}</span></p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">{project.name}</h1>
          {project.description && <p className="mt-1 max-w-[60ch] text-[13px] text-muted">{project.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-field px-2.5 py-[3px] text-[11px] font-bold text-ink">{projectStatusLabel(project.status)}</span>
            {allowedProjectTransitions(project.status).map((s) => (
              <button key={s} onClick={() => void moveProject(s)} className="rounded-full border border-line px-2.5 py-1 text-[11.5px] font-semibold text-ink hover:border-line-strong">→ {projectStatusLabel(s)}</button>
            ))}
          </div>
        </div>
        <button onClick={() => setAdding(true)} className="rounded-full bg-brand px-4 py-2.5 text-[13px] font-semibold text-on-brand hover:bg-brand-2">+ Add task</button>
      </div>

      <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
        {BOARD.map((col) => {
          const items = tasks.filter((t) => t.status === col);
          return (
            <div key={col} className="w-[230px] flex-none">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[.05em]" style={{ color: COL_TONE[col] }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: COL_TONE[col] }} />{taskStatusLabel(col)}
                </span>
                <span className="text-[12px] text-muted">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((t) => (
                  <div key={t.id} className="rounded-xl border border-line bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <b className="text-[13.5px] font-semibold leading-snug">{t.title}</b>
                      <span className="flex-none rounded-full px-2 py-[2px] text-[10px] font-bold" style={PRIORITY_TONE[t.priority]}>{t.priority}</span>
                    </div>
                    {t.dueDate && <p className="mt-1 text-[11.5px] text-muted">Due {due(t.dueDate)}</p>}
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      <select value={t.status} onChange={(e) => void patchTask(t, { status: e.target.value as TaskStatus })}
                        className="h-7 rounded-lg bg-field px-1.5 text-[11.5px] text-ink outline-none">
                        <option value={t.status}>{taskStatusLabel(t.status)}</option>
                        {allowedTaskTransitions(t.status).map((s) => <option key={s} value={s}>→ {taskStatusLabel(s)}</option>)}
                      </select>
                      <select value={t.assigneeId ?? ''} onChange={(e) => void patchTask(t, { assigneeId: e.target.value || null })}
                        className="h-7 rounded-lg bg-field px-1.5 text-[11.5px] text-ink outline-none">
                        <option value="">Unassigned</option>
                        {members.map((m) => <option key={m.membershipId} value={m.membershipId}>{m.name}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-muted">—</p>}
              </div>
            </div>
          );
        })}
      </div>

      {adding && <AddTaskDialog projectId={id} members={members} onClose={() => setAdding(false)} onDone={() => { setAdding(false); void load(); }} />}
    </div>
  );
}

function AddTaskDialog({ projectId, members, onClose, onDone }: { projectId: string; members: TeamMemberDto[]; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (!title.trim()) { setError('Give the task a title.'); return; }
    setBusy(true);
    try {
      await api.pm.tasks.create({
        projectId, title: title.trim(), priority,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      onDone();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not add the task.'); setBusy(false); }
  }

  const inp = 'h-11 w-full rounded-[11px] bg-field px-3 text-[14px] text-ink outline-none focus:ring-1 focus:ring-brand';
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-2xl border border-line bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[17px] font-bold tracking-tight">Add task</h2>
        {error && <p className="mt-3 rounded-xl border border-[color:var(--accent)] bg-field px-3.5 py-2.5 text-[13px]" role="alert">{error}</p>}
        <label className="mb-1 mt-4 block text-[12.5px] font-medium">Title</label>
        <input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[12.5px] font-medium">Priority</label>
            <select className={inp} value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
              {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] font-medium">Due date</label>
            <input type="date" className={inp} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <label className="mb-1 mt-3 block text-[12.5px] font-medium">Assignee</label>
        <select className={inp} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.membershipId} value={m.membershipId}>{m.name}</option>)}
        </select>
        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Cancel</button>
          <button type="button" onClick={submit} disabled={busy} className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">{busy ? 'Adding…' : 'Add task'}</button>
        </div>
      </div>
    </div>
  );
}
