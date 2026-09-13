import type { IconName } from '../components/icons';

export interface NavMeta {
  label: string;
  path: string;
  icon: IconName;
}

/**
 * Maps a moduleId (from GET /modules) to its console nav entry. Only modules
 * present here appear in the sidebar; the order here is the display order.
 * Dashboard and Settings are added by the shell, not tied to a module.
 */
export const MODULE_NAV: Record<string, NavMeta> = {
  online_store: { label: 'Online store', path: '/store', icon: 'store' },
  catalog: { label: 'Catalog', path: '/catalog', icon: 'catalog' },
  inventory: { label: 'Inventory', path: '/inventory', icon: 'inventory' },
  crm: { label: 'Customers', path: '/customers', icon: 'crm' },
  accounting: { label: 'Accounting', path: '/accounting', icon: 'accounting' },
  project_management: { label: 'Projects', path: '/projects', icon: 'projects' },
  mini_site: { label: 'Mini-site', path: '/site', icon: 'store' },
};

export const MODULE_ORDER = [
  'online_store',
  'catalog',
  'inventory',
  'crm',
  'accounting',
  'project_management',
  'mini_site',
];
