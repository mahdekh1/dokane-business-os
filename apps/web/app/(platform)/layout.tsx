'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '../../src/components/icons';
import { LogoMark } from '../../src/components/logo';
import { api, ApiError } from '../../src/lib/api';
import { getToken, clearSession } from '../../src/lib/session';

const nav = [
  { label: 'Overview', href: '/admin', icon: 'dashboard' as const },
  { label: 'Businesses', href: '/admin', icon: 'store' as const },
  { label: 'Approvals', href: '/admin', icon: 'approvals' as const },
  { label: 'Users', href: '/admin', icon: 'team' as const },
  { label: 'Audit log', href: '/admin', icon: 'audit' as const },
  { label: 'Settings', href: '/admin', icon: 'settings' as const },
];

export default function PlatformLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const me = await api.me();
        if (!me.user.isPlatformAdmin) {
          router.replace('/dashboard');
          return;
        }
        setReady(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) clearSession();
        router.replace('/login');
      }
    })();
  }, [router]);

  if (!ready) {
    return <div className="grid min-h-dvh place-items-center text-[14px] text-muted">Loading…</div>;
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-[248px] flex-none flex-col p-[14px] pt-[18px] text-[#C9D6D0]" style={{ background: 'var(--nav)' }}>
        <div className="flex items-center gap-2.5 px-2 pt-1 text-[18px] font-bold" style={{ color: 'var(--on-brand)' }}>
          <LogoMark size={26} tone="var(--on-brand)" /> Dokane
        </div>
        <p className="mx-2 mb-2 mt-3 rounded-lg border px-2.5 py-1.5 text-center text-[11px] uppercase tracking-[.14em] text-[#8fb3a8]"
          style={{ background: 'rgba(255,255,255,.06)', borderColor: 'rgba(255,255,255,.1)' }}>
          Platform admin
        </p>
        {nav.map((n, i) => {
          const C = Icon[n.icon];
          const active = i === 0 && pathname === '/admin';
          return (
            <Link key={n.label} href={n.href}
              className="mb-0.5 flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[14px] font-medium"
              style={active ? { background: 'var(--brand)', color: 'var(--on-brand)' } : { color: '#C3D1CB' }}>
              <C /><span>{n.label}</span>
            </Link>
          );
        })}
        <button onClick={() => { clearSession(); router.replace('/login'); }} className="mt-auto px-2.5 pt-2.5 text-left text-[12px] text-[#7d8a84] hover:text-[#C9D6D0]">
          Sign out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-6">
          <div className="text-[14px] font-semibold">Platform overview <span className="font-normal text-muted">· all businesses</span></div>
          <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-brand text-[12.5px] font-bold text-on-brand">PA</span>
        </header>
        <main className="overflow-auto p-7">{children}</main>
      </div>
    </div>
  );
}
