import type { ModuleManifest } from '@dokane/module-sdk';

/**
 * MVP module manifests. As each feature module is built (Phase 3+), its manifest
 * moves next to its code; the registry then collects them. For now they live
 * here so packaging, entitlements and the Modules page are testable end-to-end.
 * `permissions` are filled in by each module when it is built.
 */
export const MODULE_MANIFESTS: ModuleManifest[] = [
  {
    id: 'catalog',
    name: 'Catalog',
    version: '1.0.0',
    dependsOn: [],
    requiredEntitlement: 'catalog',
    permissions: [],
  },
  {
    id: 'inventory',
    name: 'Inventory',
    version: '1.0.0',
    dependsOn: ['catalog'],
    requiredEntitlement: 'inventory',
    permissions: [],
  },
  {
    id: 'channels',
    name: 'Sales Channels',
    version: '1.0.0',
    dependsOn: [],
    requiredEntitlement: 'channels',
    permissions: [],
  },
  {
    id: 'online_store',
    name: 'Online Store',
    version: '1.0.0',
    dependsOn: ['catalog', 'channels'],
    requiredEntitlement: 'online_store',
    permissions: [],
  },
  {
    id: 'accounting',
    name: 'Basic Accounting',
    version: '1.0.0',
    dependsOn: [],
    requiredEntitlement: 'accounting',
    permissions: [],
  },
  {
    id: 'crm',
    name: 'CRM',
    version: '1.0.0',
    dependsOn: [],
    requiredEntitlement: 'crm',
    permissions: [],
  },
  {
    id: 'project_management',
    name: 'Project Management',
    version: '1.0.0',
    dependsOn: [],
    requiredEntitlement: 'project_management',
    permissions: [],
  },
  {
    id: 'mini_site',
    name: 'Mini-site',
    version: '1.0.0',
    dependsOn: [],
    requiredEntitlement: 'mini_site',
    permissions: [],
  },
  {
    id: 'notifications',
    name: 'Notifications',
    version: '1.0.0',
    dependsOn: [],
    requiredEntitlement: 'notifications',
    permissions: [],
  },
  {
    id: 'ai',
    name: 'AI Assistant',
    version: '1.0.0',
    dependsOn: [],
    requiredEntitlement: 'ai',
    permissions: [],
  },
];

/** Plan tier → entitlement keys it grants. Mirrors PRD.md §3. */
export const PLAN_ENTITLEMENTS: Record<string, string[]> = {
  STARTER: ['catalog', 'mini_site'],
  GROWTH: [
    'catalog',
    'mini_site',
    'channels',
    'online_store',
    'inventory',
    'notifications',
    'crm',
    'accounting',
  ],
  BUSINESS: [
    'catalog',
    'mini_site',
    'channels',
    'online_store',
    'inventory',
    'notifications',
    'crm',
    'accounting',
    'project_management',
    'ai',
  ],
  ENTERPRISE: MODULE_MANIFESTS.map((m) => m.requiredEntitlement),
};

export const PLAN_NAMES: Record<string, string> = {
  STARTER: 'Starter',
  GROWTH: 'Growth',
  BUSINESS: 'Business',
  ENTERPRISE: 'Enterprise',
};
