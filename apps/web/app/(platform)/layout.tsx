'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, type IconName } from '../../src/components/icons';
import { LogoMark } from '../../src/components/logo';
import { api, ApiError } from '../../src/lib/api';
import type { MeResponse } from '@dokane/contracts';
import { getToken, clearSession } from '../../src/lib/session';

const initials = (s: string) =>
  s.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const NAV: { label: string; href: string; icon: IconName }[] = [
  { label: 'Overview', href: '/admin', icon: 'dashboard' },
  { label: 'Users', href: '/admin/users', icon: 'team' },
  { label: 'Audit log', href: '/admin/audit', icon: 'audit' },
  { label: 'Settings', href: '/admin/settings', icon: 'settings' },
];

export default function PlatformLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const data = await api.me();
        if (!data.user.isPlatformAdmin) {
          router.replace('/dashboard');
          return;
        }
        setMe(data);
        setReady(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) clearSession();
        router.replace('/login');
      }
    })();
  }, [router]);

  if (!ready || !me) {
    return <div className="grid min-h-dvh place-items-center text-[14px] text-muted">Loading…</div>;
  }

  const isActive = (href: string) =>
    href === '/admin'
      ? pathname === '/admin' || pathname.startsWith('/admin/businesses')
      : pathname === href || pathname.startsWith(href + '/');
  const active = NAV.find((n) => isActive(n.href)) ?? NAV[0]!;
  const headerTitle = pathname.startsWith('/admin/account') ? 'Account' : active.label;

  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-[256px] flex-none flex-col p-[14px] pt-[18px] text-[#C9D6D0]" style={{ background: 'var(--nav)' }}>
        <div className="flex items-center gap-2.5 px-2 pt-1 text-[18px] font-bold" style={{ color: 'var(--on-brand)' }}>
          <LogoMark size={26} tone="var(--on-brand)" /> Dokane
        </div>
        <p className="mx-2 mb-2 mt-3 rounded-lg border px-2.5 py-1.5 text-center text-[11px] uppercase tracking-[.14em] text-[#8fb3a8]"
          style={{ background: 'rgba(255,255,255,.06)', borderColor: 'rgba(255,255,255,.1)' }}>
          Platform admin
        </p>

        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const C = Icon[n.icon];
            return (
              <Link key={n.label} href={n.href}
                className="flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[14px] font-medium transition-colors"
                style={isActive(n.href) ? { background: 'var(--brand)', color: 'var(--on-brand)' } : { color: '#C3D1CB' }}>
                <C /><span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-6">
          <div className="text-[14px] font-semibold">
            {headerTitle} <span className="font-normal text-muted">· all businesses</span>
          </div>

          <div className="relative">
            <button aria-label="Account menu" onClick={() => setUserMenuOpen((v) => !v)}
              className="grid h-[34px] w-[34px] place-items-center rounded-full bg-brand text-[12.5px] font-bold text-on-brand">
              {initials(`${me.user.firstName} ${me.user.lastName}`)}
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-[44px] z-20 w-[224px] rounded-xl border border-line bg-surface p-1.5 shadow-lg">
                <div className="px-2.5 pb-1.5 pt-1">
                  <b className="block text-[13.5px]">{me.user.firstName} {me.user.lastName}</b>
                  <span className="block text-[12px] text-muted">{me.user.email}</span>
                </div>
                <div className="my-1 h-px bg-line" />
                <Link href="/admin/account" onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-ink hover:bg-field">
                  <Icon.team width={16} height={16} /> Account &amp; profile
                </Link>
                <button onClick={() => { clearSession(); router.replace('/login'); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink hover:bg-field">
                  <Icon.logout width={16} height={16} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="overflow-auto p-7">{children}</main>
      </div>
    </div>
  );
}
