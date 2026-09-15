import Link from 'next/link';
import { Icon, type IconName } from '../../../src/components/icons';

const STEPS: { title: string; body: string; href: string; icon: IconName }[] = [
  { title: 'Turn on the modules you need', body: 'Enable catalog, storefront, inventory and more from your plan.', href: '/modules', icon: 'dashboard' },
  { title: 'Customize your brand', body: 'Set your colors, fonts and logo for your public mini-site.', href: '/settings/branding', icon: 'settings' },
  { title: 'Add your products & services', body: 'Build your catalog — physical goods, services or courses.', href: '/catalog', icon: 'catalog' },
  { title: 'Set up your storefront', body: 'Publish your pages and start taking online orders.', href: '/storefront/pages', icon: 'store' },
];

const METRICS = ['Sales', 'Orders', 'Low stock', 'Outstanding'];

export default function DashboardPage() {
  return (
    <div className="max-w-[920px]">
      <h1 className="text-[24px] font-bold tracking-tight">Overview</h1>
      <p className="mt-1 text-[13.5px] text-muted">
        Your dashboard fills up as you start selling. Get set up in a few steps.
      </p>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <b className="text-[15px] font-semibold">Getting started</b>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {STEPS.map((s) => {
            const C = Icon[s.icon];
            return (
              <Link key={s.title} href={s.href}
                className="group flex items-start gap-3 rounded-xl border border-line p-3.5 transition-colors hover:border-line-strong">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] text-brand" style={{ background: 'rgba(14,106,87,.10)' }}><C /></span>
                <span className="min-w-0">
                  <b className="block text-[14px] font-semibold text-ink">{s.title}</b>
                  <span className="block text-[12.5px] leading-[1.5] text-muted">{s.body}</span>
                </span>
                <span className="ml-auto self-center text-muted transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            );
          })}
        </div>
      </section>

      <p className="mb-2.5 mt-7 text-[12px] font-semibold uppercase tracking-[.1em] text-muted">What you'll see here</p>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {METRICS.map((label) => (
          <div key={label} className="flex flex-col gap-1 rounded-2xl border border-dashed border-line bg-surface p-[18px]">
            <span className="text-[13px] text-muted">{label}</span>
            <b className="text-[26px] font-bold tracking-tight text-muted">—</b>
            <span className="text-[12px] text-muted">No data yet</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-muted">
        Sales, orders and low-stock alerts appear here once you add products and start taking orders.
      </p>
    </div>
  );
}
