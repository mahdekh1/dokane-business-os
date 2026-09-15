'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, type IconName } from '../../src/components/icons';
import { LogoMark } from '../../src/components/logo';
import { api, ApiError, type ModuleView } from '../../src/lib/api';
import type { MeBusiness, MeResponse, PlanSummary } from '@dokane/contracts';
import { getBusinessId, setBusinessId, clearSession, getToken } from '../../src/lib/session';
import { NAV_GROUPS, SETTINGS_GROUP, type NavGroup } from '../../src/lib/module-nav';

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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Explicit expand/collapse overrides; unset groups default to "open if active".
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});

  // Close the mobile nav drawer whenever the route changes (a link was tapped).
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

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

  const activeSet = new Set(modules.filter((m) => m.state === 'active').map((m) => m.id));
  const activeCount = activeSet.size;
  const isActive = (p: string) => pathname === p || pathname.startsWith(p + '/');
  const groupIsActive = (g: NavGroup) =>
    g.href ? isActive(g.href) : (g.children?.some((c) => !c.deepLink && pathname === c.href) ?? false);
  const isOpen = (g: NavGroup) => openOverrides[g.id] ?? groupIsActive(g);
  const toggle = (g: NavGroup) =>
    setOpenOverrides((o) => ({ ...o, [g.id]: !isOpen(g) }));

  const visibleGroups = NAV_GROUPS.filter(
    (g) => !g.requires || g.requires.some((id) => activeSet.has(id)),
  );

  return (
    <div className="flex min-h-dvh">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[256px] flex-none flex-col p-[14px] pt-[18px] text-[#C9D6D0] transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--nav)' }}
      >
        <div className="flex items-center gap-2.5 px-2 pb-[14px] pt-1 text-[18px] font-bold" style={{ color: 'var(--on-brand)' }}>
          <LogoMark size={26} tone="var(--on-brand)" />
          Dokane
        </div>
        <p className="mx-2.5 mb-1.5 mt-3 text-[11px] uppercase tracking-[.14em] text-[#6f7d77]">Workspace</p>

        <nav className="flex flex-col gap-0.5 overflow-y-auto">
          {visibleGroups.map((g) =>
            g.href ? (
              <NavLink key={g.id} href={g.href} label={g.label} icon={g.icon} active={isActive(g.href)} />
            ) : (
              <NavGroupItem key={g.id} group={g} open={isOpen(g)} onToggle={() => toggle(g)} active={groupIsActive(g)} pathname={pathname} />
            ),
          )}
          <div className="mx-1.5 my-2 h-px" style={{ background: 'rgba(255,255,255,.07)' }} />
          <NavGroupItem group={SETTINGS_GROUP} open={isOpen(SETTINGS_GROUP)} onToggle={() => toggle(SETTINGS_GROUP)} active={groupIsActive(SETTINGS_GROUP)} pathname={pathname} />
        </nav>

        <div className="mt-auto rounded-[14px] border p-3.5" style={{ background: 'rgba(255,255,255,.05)', borderColor: 'rgba(255,255,255,.09)' }}>
          <b className="text-[13.5px]" style={{ color: 'var(--on-brand)' }}>{plan ? `${plan.name} plan` : 'Your plan'}</b>
          <p className="mb-2.5 mt-0.5 text-[12px] text-[#8f9c96]">{activeCount} modules active</p>
          <Link href="/modules" className="block rounded-[9px] py-2 text-center text-[12.5px] font-semibold" style={{ background: 'rgba(255,255,255,.1)', color: 'var(--on-brand)' }}>
            Manage plan
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <button type="button" aria-label="Open menu" onClick={() => setSidebarOpen(true)}
              className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] border border-line text-muted hover:text-ink md:hidden">
              <Icon.menu />
            </button>
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
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <button aria-label="Account menu" onClick={() => setUserMenuOpen((v) => !v)}
                className="grid h-[34px] w-[34px] place-items-center rounded-full bg-accent text-[12.5px] font-bold" style={{ color: '#3a2408' }}>
                {initials(`${me?.user.firstName ?? ''} ${me?.user.lastName ?? ''}`)}
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-[44px] z-20 w-[224px] rounded-xl border border-line bg-surface p-1.5 shadow-lg">
                  <div className="px-2.5 pb-1.5 pt-1">
                    <b className="block text-[13.5px]">{me?.user.firstName} {me?.user.lastName}</b>
                    <span className="block text-[12px] text-muted">{me?.user.email}</span>
                  </div>
                  <div className="my-1 h-px bg-line" />
                  <Link href="/account" onClick={() => setUserMenuOpen(false)}
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
          </div>
        </header>

        <main className="overflow-auto p-7">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ href, label, icon, active }: { href: string; label: string; icon: IconName; active: boolean }) {
  const C = Icon[icon];
  return (
    <Link
      href={href}
      className="flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[14px] font-medium transition-colors"
      style={active ? { background: 'var(--brand)', color: 'var(--on-brand)' } : { color: '#C3D1CB' }}
    >
      <C />
      <span>{label}</span>
    </Link>
  );
}

function NavGroupItem({
  group, open, onToggle, active, pathname,
}: { group: NavGroup; open: boolean; onToggle: () => void; active: boolean; pathname: string }) {
  const C = Icon[group.icon];
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[14px] font-medium transition-colors hover:bg-[rgba(255,255,255,.05)]"
        style={{ color: active ? 'var(--on-brand)' : '#C3D1CB' }}
      >
        <C />
        <span>{group.label}</span>
        <Icon.chevronDown
          width={13}
          height={13}
          style={{ marginLeft: 'auto', opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }}
        />
      </button>
      {open && group.children && (
        <div className="mb-1 ml-[22px] mt-0.5 border-l pl-3" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
          {group.children.map((c) => {
            const on = pathname === c.href && !c.deepLink;
            return (
              <Link
                key={c.label}
                href={c.href}
                className="flex items-center gap-2.5 rounded-lg px-[11px] py-[7px] text-[13px] transition-colors"
                style={on ? { background: 'rgba(255,255,255,.06)', color: 'var(--on-brand)', fontWeight: 600 } : { color: '#a9b8b2' }}
              >
                <span className="inline-block h-[5px] w-[5px] flex-none rounded-full" style={{ background: 'currentColor', opacity: 0.55 }} />
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
