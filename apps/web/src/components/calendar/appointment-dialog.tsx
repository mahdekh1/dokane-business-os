'use client';

import { useEffect, useState } from 'react';
import type { AppointmentDto, CustomerDto, TeamMemberDto } from '@dokane/contracts';
import { APPOINTMENT_STATUSES, appointmentStatusLabel } from '@dokane/contracts';
import { api, ApiError } from '../../lib/api';

/** ISO → value for <input type="datetime-local"> in local time. */
function toLocalInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentDialog({
  appointment,
  onClose,
  onDone,
}: {
  appointment?: AppointmentDto;
  onClose: () => void;
  onDone: () => void;
}) {
  const editing = Boolean(appointment);
  const [title, setTitle] = useState(appointment?.title ?? '');
  const [startsAt, setStartsAt] = useState(toLocalInput(appointment?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(appointment?.endsAt ?? (appointment ? undefined : new Date(Date.now() + 2 * 3_600_000).toISOString())));
  const [status, setStatus] = useState(appointment?.status ?? 'SCHEDULED');
  const [assigneeId, setAssigneeId] = useState(appointment?.assigneeId ?? '');
  const [customerId, setCustomerId] = useState(appointment?.customerId ?? '');
  const [location, setLocation] = useState(appointment?.location ?? '');
  const [note, setNote] = useState(appointment?.note ?? '');
  const [members, setMembers] = useState<TeamMemberDto[]>([]);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.team.members().then(setMembers).catch(() => undefined);
    void api.customers.list({ pageSize: 100 }).then((r) => setCustomers(r.items)).catch(() => undefined);
  }, []);

  async function submit() {
    setError('');
    if (!title.trim()) { setError('Give the appointment a title.'); return; }
    const startIso = new Date(startsAt).toISOString();
    const endIso = new Date(endsAt).toISOString();
    if (new Date(endIso) <= new Date(startIso)) { setError('End must be after start.'); return; }
    setBusy(true);
    try {
      if (editing && appointment) {
        await api.calendar.appointments.update(appointment.id, {
          title: title.trim(), startsAt: startIso, endsAt: endIso, status,
          assigneeId: assigneeId || null, customerId: customerId || null,
          location: location.trim() || null, note: note.trim() || null,
        });
      } else {
        await api.calendar.appointments.create({
          title: title.trim(), startsAt: startIso, endsAt: endIso, status,
          assigneeId: assigneeId || undefined, customerId: customerId || undefined,
          location: location.trim() || undefined, note: note.trim() || undefined,
        });
      }
      onDone();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not save the appointment.'); setBusy(false); }
  }

  const inp = 'h-11 w-full rounded-[11px] bg-field px-3 text-[14px] text-ink outline-none focus:ring-1 focus:ring-brand';
  const lbl = 'mb-1 block text-[12.5px] font-medium';
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[17px] font-bold tracking-tight">{editing ? 'Edit appointment' : 'New appointment'}</h2>
        {error && <p className="mt-3 rounded-xl border border-[color:var(--accent)] bg-field px-3.5 py-2.5 text-[13px]" role="alert">{error}</p>}
        <label className={`${lbl} mt-4`}>Title</label>
        <input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. Client consultation" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div><label className={lbl}>Starts</label><input type="datetime-local" className={inp} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
          <div><label className={lbl}>Ends</label><input type="datetime-local" className={inp} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>Status</label>
            <select className={inp} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              {APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{appointmentStatusLabel(s)}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Assignee</label>
            <select className={inp} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.membershipId} value={m.membershipId}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <label className={`${lbl} mt-3`}>Customer <span className="font-normal text-muted">(optional)</span></label>
        <select className={inp} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">No customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className={`${lbl} mt-3`}>Location <span className="font-normal text-muted">(optional)</span></label>
        <input className={inp} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Studio, video call…" />
        <label className={`${lbl} mt-3`}>Note <span className="font-normal text-muted">(optional)</span></label>
        <textarea className="min-h-[60px] w-full rounded-[11px] bg-field px-3 py-2.5 text-[14px] text-ink outline-none focus:ring-1 focus:ring-brand" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Cancel</button>
          <button type="button" onClick={submit} disabled={busy} className="rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">{busy ? 'Saving…' : editing ? 'Save' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}
