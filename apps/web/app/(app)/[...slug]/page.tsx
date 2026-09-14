'use client';

import { useParams } from 'next/navigation';

// Section label for the leading path segment, for the breadcrumb.
const SECTION: Record<string, string> = {
  storefront: 'Storefront',
  catalog: 'Catalog',
  inventory: 'Inventory',
  channels: 'Sales Channels',
  crm: 'Customers / CRM',
  accounting: 'Accounting',
  notifications: 'Notifications',
  calendar: 'Calendar',
  projects: 'Projects',
  ai: 'AI Assistant',
  settings: 'Settings',
  account: 'Account',
};

const titleCase = (s: string) =>
  s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Placeholder for module sub-routes whose real screens land in Phase 3+.
 * Concrete routes (e.g. /settings/branding) take precedence over this catch-all.
 */
export default function PlaceholderPage() {
  const params = useParams<{ slug: string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug : [params.slug].filter(Boolean);
  const section = SECTION[slug[0] ?? ''] ?? 'Console';
  const leaf = slug.length > 0 ? titleCase(slug[slug.length - 1]!) : section;

  return (
    <div className="max-w-[820px]">
      <p className="mb-2 text-[12.5px] text-muted">
        {section}{leaf !== section ? <> / <span className="font-medium text-ink">{leaf}</span></> : null}
      </p>
      <h1 className="font-display text-[27px] font-medium tracking-tight">{leaf}</h1>
      <p className="mt-1.5 text-[14px] text-muted">This section is part of {section}.</p>

      <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-field text-[18px]">🚧</div>
        <h2 className="text-[16px] font-semibold">Coming soon</h2>
        <p className="mx-auto mt-1.5 max-w-[46ch] text-[13.5px] text-muted">
          The navigation and settings for this module are ready. Its screens are
          being built and will appear here in an upcoming phase.
        </p>
      </div>
    </div>
  );
}
