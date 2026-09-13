import type { ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '../../src/components/icons';
import { LogoMark } from '../../src/components/logo';

const nav = [
  { label: 'Overview', href: '/admin', icon: 'dashboard' as const, active: true },
  { label: 'Businesses', href: '/admin/businesses', icon: 'store' as const },
  { label: 'Approvals', href: '/admin/approvals', icon: 'approvals' as const, badge: '6' },
  { label: 'Users', href: '/admin/users', icon: 'team' as const },
  { label: 'Audit log', href: '/admin/audit', icon: 'audit' as const },
  { label: 'Settings', href: '/admin/settings', icon: 'settings' as const },
];

/* NOTE: platform-admin authorization is wired in Phase 2 (Task 2.1). This shell
   renders the operator view; access control is not yet enforced here. */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-[248px] flex-none flex-col p-[14px] pt-[18px] text-[#C9D6D0]" style={{ background: 'var(--nav)' }}>
        <div className="flex items-center gap-2.5 px-2 pt-1 text-[18px] font-bold" style={{ color: 'var(--on-brand)' }}>
          <LogoMark size={26} tone="var(--on-brand)" />
          Dokane
        </div>
        <p className="mx-2 mb-2 mt-3 rounded-lg border px-2.5 py-1.5 text-center text-[11px] uppercase tracking-[.14em] text-[#8fb3a8]"
          style={{ background: 'rgba(255,255,255,.06)', borderColor: 'rgba(255,255,255,.1)' }}>
          Platform admin
        </p>
        {nav.map((n) => {
          const C = Icon[n.icon];
          return (
            <Link key={n.href} href={n.href}
              className="mb-0.5 flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[14px] font-medium"
              style={n.active ? { background: 'var(--brand)', color: 'var(--on-brand)' } : { color: '#C3D1CB' }}>
              <C />
              <span>{n.label}</span>
              {n.badge && (
                <span className="ml-auto rounded-full px-2 py-px text-[11px] font-bold" style={{ background: 'var(--accent)', color: '#3a2408' }}>
                  {n.badge}
                </span>
              )}
            </Link>
          );
        })}
        <div className="mt-auto px-2.5 pt-2.5 text-[12px] text-[#7d8a84]">v0.1 · Dokane platform</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-6">
          <div className="text-[14px] font-semibold">Platform overview <span className="font-normal text-muted">· all businesses</span></div>
          <div className="flex items-center gap-2.5">
            <button aria-label="Notifications" className="grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-line text-muted hover:text-ink">
              <Icon.bell />
            </button>
            <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-brand text-[12.5px] font-bold text-on-brand">PA</span>
          </div>
        </header>
        <main className="overflow-auto p-7">{children}</main>
      </div>
    </div>
  );
}
