'use client';

import { useEffect, useState } from 'react';
import type { LocationDto } from '@dokane/contracts';
import { api } from '../../../../src/lib/api';

export default function InventorySettingsPage() {
  const [locations, setLocations] = useState<LocationDto[] | null>(null);

  useEffect(() => { void api.inventory.locations().then(setLocations).catch(() => setLocations([])); }, []);

  return (
    <div className="max-w-[720px]">
      <h1 className="text-[24px] font-bold tracking-tight">Inventory settings</h1>
      <p className="mt-1 text-[13.5px] text-muted">Where you hold stock.</p>

      <div className="mt-5 rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <b className="text-[14px]">Locations</b>
          <span className="text-[12px] text-muted">Multi-location coming soon</span>
        </div>
        {!locations ? (
          <p className="p-6 text-[14px] text-muted">Loading…</p>
        ) : (
          <ul>
            {locations.map((l) => (
              <li key={l.id} className="flex items-center justify-between border-b border-line px-4 py-3 last:border-b-0 text-[13.5px]">
                <span className="font-medium">{l.name}{l.code ? <span className="text-muted"> · {l.code}</span> : null}</span>
                {l.isDefault && <span className="rounded-full bg-field px-2.5 py-[3px] text-[11px] font-semibold text-muted">Default</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
