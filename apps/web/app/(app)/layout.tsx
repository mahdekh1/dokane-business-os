'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '../../src/components/icons';
import { LogoMark } from '../../src/components/logo';
import { api, ApiError, type ModuleView } from '../../src/lib/api';
import type { MeBusiness, MeResponse, PlanSummary } from '@dokane/contracts';
import { getBusinessId, setBusinessId, clearSession, getToken } from '../../src/lib/session';
import { MODULE_NAV, MODULE_ORDER } from '../../src/lib/module-nav';

const initials = (s: string) =>
  s.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [current, setCurrent] = useState<MeBusiness | null>(null);
  const [modules, setModules] = useState<ModuleView[]>([]);
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [ready, setReady] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const data = await api.me();
        setMe(data);
        if (data.businesses.length > 0) {
          const storedId = getBusinessId();
          const chosen =
            data.businesses.find((b) => b.id === storedId) ?? data.businesses[0]!;
          setBusinessId(chosen.id);
          setCurrent(chosen);
          if (chosen.status === 'APPROVED') {
            const [mods, pl] = await Promise.all([api.modules(), api.plan()]);
            setModules(mods);
            setPlan(pl);
          }
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          router.replace('/login');
          return;
        }
      } finally {
        setReady(true);
      }
    })();
  }, [router]);

  async function switchBusiness(b: MeBusiness) {
    setBusinessId(b.id);
    setCurrent(b);
    setSwitcherOpen(false);
    if (b.status === 'APPROVED') {
      const [mods, pl] = await Promise.all([api.modules(), api.plan()]);
      setModules(mods);
      setPlan(pl);
    }
  }

  if (!ready) {
    return <div className="grid min-h-dvh place-items-center text-[14px] text-muted">Loading…</div>;
  }

  if (me && me.businesses.length === 0) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="w-full max-w-[420px] rounded-2xl border border-line bg-surface p-8 text-center">
          <div className="mx-auto mb-4 w-fit"><LogoMark size={36} /></div>
          <h1 className="text-[22px] font-bold tracking-tight">Create your business</h1>
          <p className="mx-auto mb-6 mt-2 max-w-[36ch] text-[14px] text-muted">
            Your account is ready. Set up a business to start adding products, inventory and sales.
          </p>
          <Link href="/onboarding" className="inline-flex h-11 items-center rounded-full bg-brand px-6 font-semibold text-on-brand hover:bg-brand-2">
            Set up business
          </Link>
        </div>
      </div>
    );
  }

  if (current && current.status !== 'APPROVED') {
    const info =
      ({
        PENDING_APPROVAL: {
          title: 'Waiting for approval',
          body: 'Your business is being reviewed. We’ll let you know as soon as it’s approved.',
        },
        CHANGES_REQUESTED: {
          title: 'Changes requested',
          body: 'The reviewer asked for some changes before approving. Update your details and resubmit.',
        },
        REJECTED: {
          title: 'Application not approved',
          body: 'This business application was not approved. Contact support if you think this is a mistake.',
        },
        SUSPENDED: {
          title: 'Business suspended',
          body: 'This business is currently suspended. Contact support to restore access.',
        },
      } as Record<string, { title: string; body: string }>)[current.status] ?? {
        title: 'Not active',
        body: 'This business is not active yet.',
      };
    return (
      <div className="min-h-dvh">
        <header className="flex h-[60px] items-center justify-between border-b border-line bg-surface px-6">
          <span className="flex items-center gap-2.5 text-[17px] font-bold"><LogoMark size={26} /> Dokane</span>
          <button onClick={() => { clearSession(); router.replace('/login'); }} className="text-[13px] text-muted hover:text-ink">Sign out</button>
        </header>
        <div className="grid place-items-center p-6" style={{ minHeight: 'calc(100dvh - 60px)' }}>
          <div className="w-full max-w-[440px] rounded-2xl border border-line bg-surface p-8 text-center">
            <span className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[.1em]" style={{ background: 'rgba(217,142,75,.18)', color: '#95571b' }}>
              {current.status.replace(/_/g, ' ').toLowerCase()}
            </span>
            <h1 className="mt-4 text-[22px] font-bold tracking-tight">{info.title}</h1>
            <p className="mx-auto mt-2 max-w-[36ch] text-[14px] text-muted">{info.body}</p>
            <p className="mt-5 text-[13px] text-muted">{current.name}</p>
            {me && me.businesses.length > 1 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2 border-t border-line pt-5">
                {me.businesses.filter((b) => b.id !== current.id).map((b) => (
                  <button key={b.id} onClick={() => switchBusiness(b)} className="rounded-full border border-line px-3 py-1.5 text-[13px] hover:border-line-strong">
                    Switch to {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const navModules = MODULE_ORDER
    .filter((id) => modules.some((m) => m.id === id && m.state === 'active') && MODULE_NAV[id])
    .map((id) => ({ id, ...MODULE_NAV[id]! }));
  const activeCount = modules.filter((m) => m.state === 'active').length;
  const isActive = (p: string) => pathname === p || pathname.startsWith(p + '/');

  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-[248px] flex-none flex-col p-[14px] pt-[18px] text-[#C9D6D0]" style={{ background: 'var(--nav)' }}>
        <div className="flex items-center gap-2.5 px-2 pb-[18px] pt-1 text-[18px] font-bold" style={{ color: 'var(--on-brand)' }}>
          <LogoMark size={26} tone="var(--on-brand)" />
          Dokane
        </div>
        <p className="mx-2.5 mb-1.5 mt-3.5 text-[11px] uppercase tracking-[.14em] text-[#6f7d77]">Workspace</p>
        <NavItem href="/dashboard" label="Dashboard" active={isActive('/dashboard')}><Icon.dashboard /></NavItem>
        {navModules.map((m) => (
          <NavItem key={m.id} href={m.path} label={m.label} active={isActive(m.path)}>
            {(() => { const C = Icon[m.icon]; return <C />; })()}
          </NavItem>
        ))}
        <NavItem href="/settings/branding" label="Settings" active={isActive('/settings')}><Icon.settings /></NavItem>

        <div className="mt-auto rounded-[14px] border p-3.5" style={{ background: 'rgba(255,255,255,.05)', borderColor: 'rgba(255,255,255,.09)' }}>
          <b className="text-[13.5px]" style={{ color: 'var(--on-brand)' }}>{plan ? `${plan.name} plan` : 'Your plan'}</b>
          <p className="mb-2.5 mt-0.5 text-[12px] text-[#8f9c96]">{activeCount} modules active</p>
          <Link href="/modules" className="block rounded-[9px] py-2 text-center text-[12.5px] font-semibold" style={{ background: 'rgba(255,255,255,.1)', color: 'var(--on-brand)' }}>
            Manage plan
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-6">
          <div className="relative">
            <button onClick={() => setSwitcherOpen((v) => !v)} className="flex items-center gap-2.5 rounded-xl border border-line py-1.5 pl-1.5 pr-3 text-ink hover:border-line-strong">
              <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-brand text-[12px] font-bold text-on-brand">
                {initials(current?.name ?? '?')}
              </span>
              <span className="flex flex-col text-left leading-[1.15]">
                <b className="text-[14px] font-semibold">{current?.name}</b>
                <span className="text-[11.5px] capitalize text-muted">{current?.role.toLowerCase()}</span>
              </span>
              <Icon.chevronDown width={14} height={14} />
            </button>
            {switcherOpen && me && (
              <div className="absolute left-0 top-[52px] z-20 w-[260px] rounded-xl border border-line bg-surface p-1.5 shadow-lg">
                {me.businesses.map((b) => (
                  <button key={b.id} onClick={() => switchBusiness(b)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-field">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-[11px] font-bold text-on-brand">{initials(b.name)}</span>
                    <span className="flex flex-col leading-tight">
                      <b className="text-[13.5px] font-medium text-ink">{b.name}</b>
                      <span className="text-[11.5px] capitalize text-muted">{b.role.toLowerCase()}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button className="rounded-full bg-brand px-[15px] py-[9px] text-[13.5px] font-semibold text-on-brand hover:bg-brand-2">
              <span className="inline-flex items-center gap-1.5"><Icon.plus width={15} height={15} /> New</span>
            </button>
            <button aria-label="Notifications" className="grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-line text-muted hover:text-ink">
              <Icon.bell />
            </button>
            <button aria-label="Sign out" onClick={() => { clearSession(); router.replace('/login'); }}
              className="grid h-[34px] w-[34px] place-items-center rounded-full bg-accent text-[12.5px] font-bold" style={{ color: '#3a2408' }}>
              {initials(`${me?.user.firstName ?? ''} ${me?.user.lastName ?? ''}`)}
            </button>
          </div>
        </header>

        <main className="overflow-auto p-7">{children}</main>
      </div>
    </div>
  );
}

function NavItem({ href, label, active, children }: { href: string; label: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-0.5 flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[14px] font-medium transition-colors"
      style={active
        ? { background: 'var(--brand)', color: 'var(--on-brand)' }
        : { color: '#C3D1CB' }}
    >
      {children}
      <span>{label}</span>
    </Link>
  );
}
