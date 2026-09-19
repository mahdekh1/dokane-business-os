'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AppointmentDto } from '@dokane/contracts';
import { appointmentStatusLabel } from '@dokane/contracts';
import { api } from '../../../src/lib/api';
import { AppointmentDialog } from '../../../src/components/calendar/appointment-dialog';

const STATUS_TONE: Record<string, { background: string; color: string }> = {
  SCHEDULED: { background: 'var(--field)', color: 'var(--muted)' },
  CONFIRMED: { background: 'rgba(120,150,210,.18)', color: '#a9c0ef' },
  COMPLETED: { background: 'rgba(18,144,122,.16)', color: '#5fd3b6' },
  CANCELLED: { background: 'var(--field)', color: 'var(--muted)' },
  NO_SHOW: { background: 'rgba(224,139,122,.16)', color: '#e08b7a' },
};
const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const dayKey = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

export default function SchedulePage() {
  const [items, setItems] = useState<AppointmentDto[] | null>(null);
  const [dialog, setDialog] = useState<{ appointment?: AppointmentDto } | null>(null);

  const load = useCallback(async () => {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    setItems((await api.calendar.appointments.list({ from: from.toISOString(), pageSize: 200 })).items);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const groups = new Map<string, AppointmentDto[]>();
  for (const a of items ?? []) {
    const k = dayKey(a.startsAt);
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }

  return (
    <div className="max-w-[820px]">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Schedule</h1>
          <p className="mt-1 text-[13.5px] text-muted">Upcoming appointments. <Link href="/calendar/integrations" className="text-brand hover:underline">Connect a calendar</Link> to sync.</p>
        </div>
        <button onClick={() => setDialog({})} className="rounded-full bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-on-brand hover:bg-brand-2">+ New appointment</button>
      </div>

      {!items ? (
        <p className="mt-6 text-[14px] text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-line bg-surface p-10 text-center">
          <p className="text-[15px] font-semibold">Nothing scheduled</p>
          <p className="mx-auto mt-1 max-w-[42ch] text-[13.5px] text-muted">Book an appointment — it’ll show here, grouped by day.</p>
          <button onClick={() => setDialog({})} className="mt-4 rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-on-brand">+ New appointment</button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          {[...groups.entries()].map(([day, appts]) => (
            <div key={day}>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-[.06em] text-muted">{day}</p>
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                {appts.map((a) => (
                  <button key={a.id} onClick={() => setDialog({ appointment: a })}
                    className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-field/40">
                    <span className="w-[92px] flex-none text-[13px] font-semibold tabular-nums">{time(a.startsAt)}<span className="text-muted"> – {time(a.endsAt)}</span></span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[14px] font-semibold">{a.title}</b>
                      <span className="block truncate text-[12px] text-muted">{[a.customerName, a.assigneeName, a.location].filter(Boolean).join(' · ') || '—'}</span>
                    </span>
                    <span className="flex-none rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={STATUS_TONE[a.status]}>{appointmentStatusLabel(a.status)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {dialog && <AppointmentDialog appointment={dialog.appointment} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void load(); }} />}
    </div>
  );
}
