'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CalendarConnectionDto } from '@dokane/contracts';
import { calendarProviderLabel } from '@dokane/contracts';
import { api, ApiError } from '../../../../src/lib/api';

export default function CalendarIntegrationsPage() {
  const [conns, setConns] = useState<CalendarConnectionDto[] | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => { setConns(await api.calendar.connections()); }, []);
  useEffect(() => { void load(); }, [load]);

  async function connect(provider: string) {
    setNotice('');
    try {
      await api.calendar.connect(provider);
      void load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'Could not start the connection.');
    }
  }

  return (
    <div className="max-w-[680px]">
      <h1 className="text-[24px] font-bold tracking-tight">Connect a calendar</h1>
      <p className="mt-1 text-[13.5px] text-muted">Two-way sync keeps your Dokane appointments and your Google or Apple calendar in step.</p>

      {notice && <p className="mt-4 rounded-xl border border-line bg-field px-4 py-3 text-[13.5px]" role="status">{notice}</p>}

      <div className="mt-5 flex flex-col gap-3">
        {(conns ?? []).map((c) => (
          <div key={c.provider} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-field text-[18px]">{c.provider === 'GOOGLE' ? '📅' : '' }</span>
            <div className="min-w-0 flex-1">
              <b className="text-[14.5px] font-semibold">{calendarProviderLabel(c.provider)}</b>
              <p className="text-[12.5px] text-muted">
                {c.status === 'CONNECTED' ? `Connected${c.accountEmail ? ` · ${c.accountEmail}` : ''}` : c.configured ? 'Not connected yet.' : 'Not available on this server yet.'}
              </p>
            </div>
            {c.status === 'CONNECTED' ? (
              <button onClick={() => void api.calendar.disconnect(c.provider).then(setConns)} className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink hover:border-line-strong">Disconnect</button>
            ) : (
              <button onClick={() => void connect(c.provider)} disabled={!c.configured}
                className="rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-on-brand hover:bg-brand-2 disabled:cursor-not-allowed disabled:opacity-50">
                Connect
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-dashed border-line bg-surface p-4 text-[12.5px] text-muted">
        <b className="text-ink">Setup pending.</b> Calendar sync is built into Dokane but not yet switched on for this server — it needs Google OAuth credentials (and, for Apple, CalDAV access). Once configured, the <b className="text-ink">Connect</b> buttons go live and appointments sync both ways.
      </div>
    </div>
  );
}
