import type { IconName } from '../components/icons';

export interface NavChild {
  label: string;
  href: string;
  /**
   * A shortcut into another group's route (e.g. the Online Store channel points
   * into Storefront). It never counts toward its own group's active state and is
   * never highlighted, so the destination group owns the active styling.
   */
  deepLink?: boolean;
}

export interface NavGroup {
  /** Stable id for the expand/collapse state. */
  id: string;
  label: string;
  icon: IconName;
  /** A single-link group (Dashboard) navigates here and has no children. */
  href?: string;
  children?: NavChild[];
  /**
   * Module ids that gate this group. The group shows when ANY of them is an
   * active module for the business. Groups without `requires` always show.
   */
  requires?: string[];
}

/**
 * Console navigation, agreed IA (Phase 2.5). Each module is a collapsible group
 * with its own sub-pages + a Settings item. `mini_site` + `online_store` present
 * as one **Storefront** group; **Sales Channels** is the "where you sell" group
 * (its Online Store entry deep-links into Storefront). Sub-routes are placeholders
 * until each module is built (Phase 3+); the shell only shows a group when its
 * gating module is active. Dashboard and Settings always show.
 */
export const NAV_GROUPS: NavGroup[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: '/dashboard' },
  {
    id: 'storefront',
    label: 'Storefront',
    icon: 'store',
    requires: ['mini_site', 'online_store'],
    children: [
      { label: 'Pages', href: '/storefront/pages' },
      { label: 'Online orders', href: '/storefront/orders' },
      { label: 'Settings', href: '/storefront/settings' },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    icon: 'catalog',
    requires: ['catalog'],
    children: [
      { label: 'Products & services', href: '/catalog' },
      { label: 'Categories', href: '/catalog/categories' },
      { label: 'Settings', href: '/catalog/settings' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'inventory',
    requires: ['inventory'],
    children: [
      { label: 'Stock by location', href: '/inventory' },
      { label: 'Movements', href: '/inventory/movements' },
      { label: 'Low-stock alerts', href: '/inventory/low-stock' },
      { label: 'Settings', href: '/inventory/settings' },
    ],
  },
  {
    id: 'channels',
    label: 'Sales Channels',
    icon: 'globe',
    requires: ['channels'],
    children: [
      { label: 'In-store', href: '/channels/in-store' },
      // Deep-links into Storefront (the online store is managed there).
      { label: 'Online Store', href: '/storefront/pages', deepLink: true },
      { label: 'Connect to Marketplace', href: '/channels/marketplace' },
      { label: 'Settings', href: '/channels/settings' },
    ],
  },
  {
    id: 'crm',
    label: 'Customers / CRM',
    icon: 'crm',
    requires: ['crm'],
    children: [
      { label: 'Customers', href: '/crm/customers' },
      { label: 'Leads & pipeline', href: '/crm/pipeline' },
      { label: 'Sources', href: '/crm/sources' },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    icon: 'accounting',
    requires: ['accounting'],
    children: [
      { label: 'Income', href: '/accounting/income' },
      { label: 'Expenses', href: '/accounting/expenses' },
      { label: 'Receivables', href: '/accounting/receivables' },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: 'bell',
    requires: ['notifications'],
    children: [
      { label: 'Messages', href: '/notifications' },
      { label: 'Templates', href: '/notifications/templates' },
      { label: 'Settings', href: '/notifications/settings' },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: 'projects',
    requires: ['project_management'],
    children: [
      { label: 'Projects', href: '/projects' },
      { label: 'Tasks', href: '/projects/tasks' },
    ],
  },
  {
    id: 'ai',
    label: 'AI Assistant',
    icon: 'ai',
    requires: ['ai'],
    children: [{ label: 'Assistant', href: '/ai' }],
  },
];

/** Always-visible Settings group, rendered after a divider. */
export const SETTINGS_GROUP: NavGroup = {
  id: 'settings',
  label: 'Settings',
  icon: 'settings',
  children: [
    { label: 'Business profile', href: '/settings/business' },
    { label: 'Branding', href: '/settings/branding' },
    { label: 'Team & roles', href: '/settings/team' },
  ],
};
