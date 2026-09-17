export interface PermissionDef {
  code: string;
  moduleId: string;
  description: string;
}

/**
 * Core permissions (always present). Module-specific permissions
 * (catalog.*, inventory.*, crm.*, …) are contributed by their modules as they
 * are built (Phase 3+), and the assignable catalog for a tenant is composed
 * from its enabled modules (see MODULES.md §4).
 */
export const CORE_PERMISSIONS: PermissionDef[] = [
  { code: 'business.view', moduleId: 'core', description: 'View business profile' },
  { code: 'business.update', moduleId: 'core', description: 'Update business profile' },
  { code: 'users.view', moduleId: 'core', description: 'View team members' },
  { code: 'users.create', moduleId: 'core', description: 'Create team members' },
  { code: 'users.update', moduleId: 'core', description: 'Update team members' },
  { code: 'users.disable', moduleId: 'core', description: 'Disable team members' },
  { code: 'users.invite', moduleId: 'core', description: 'Invite team members' },
  { code: 'roles.view', moduleId: 'core', description: 'View roles' },
  { code: 'roles.manage', moduleId: 'core', description: 'Create and edit roles' },
  { code: 'locations.view', moduleId: 'core', description: 'View locations' },
  { code: 'locations.create', moduleId: 'core', description: 'Create locations' },
  { code: 'locations.update', moduleId: 'core', description: 'Update locations' },
  { code: 'locations.disable', moduleId: 'core', description: 'Disable locations' },
  { code: 'modules.view', moduleId: 'core', description: 'View available modules' },
  { code: 'modules.enable', moduleId: 'core', description: 'Enable/disable modules' },
  { code: 'billing.manage', moduleId: 'core', description: 'Manage plan and billing' },
  { code: 'reports.view', moduleId: 'core', description: 'View reports' },
  { code: 'audit.view', moduleId: 'core', description: 'View audit log' },
  { code: 'storefront.manage', moduleId: 'core', description: 'Manage the mini-site' },
  { code: 'customers.view', moduleId: 'core', description: 'View customers' },
  { code: 'customers.manage', moduleId: 'core', description: 'Create and edit customers' },
];

/** Module-contributed permissions (business-scoped). Grow as modules are built. */
export const MODULE_PERMISSIONS: PermissionDef[] = [
  { code: 'catalog.offerings.view', moduleId: 'catalog', description: 'View products' },
  { code: 'catalog.offerings.manage', moduleId: 'catalog', description: 'Create, edit and archive products' },
  { code: 'catalog.categories.manage', moduleId: 'catalog', description: 'Manage product categories' },
  { code: 'inventory.view', moduleId: 'inventory', description: 'View stock and movements' },
  { code: 'inventory.manage', moduleId: 'inventory', description: 'Adjust stock and thresholds' },
];

export const PLATFORM_PERMISSIONS: PermissionDef[] = [
  { code: 'platform.businesses.view', moduleId: 'platform', description: 'View businesses' },
  { code: 'platform.businesses.approve', moduleId: 'platform', description: 'Approve businesses' },
  { code: 'platform.businesses.reject', moduleId: 'platform', description: 'Reject businesses' },
  { code: 'platform.businesses.suspend', moduleId: 'platform', description: 'Suspend businesses' },
  { code: 'platform.users.view', moduleId: 'platform', description: 'View platform users' },
  { code: 'platform.audit.view', moduleId: 'platform', description: 'View platform audit' },
];

/** Every business-scoped permission (core + module-contributed). OWNER gets all. */
export const BUSINESS_PERMISSIONS: PermissionDef[] = [
  ...CORE_PERMISSIONS,
  ...MODULE_PERMISSIONS,
];

export const ALL_PERMISSIONS: PermissionDef[] = [
  ...BUSINESS_PERMISSIONS,
  ...PLATFORM_PERMISSIONS,
];

/** System role → the permission codes it grants. OWNER gets every business
 *  permission dynamically (see rbac.service). */
export const SYSTEM_ROLE_PERMISSIONS: Record<string, string[]> = {
  MANAGER: [
    'business.view',
    'users.view',
    'users.invite',
    'roles.view',
    'locations.view',
    'locations.create',
    'locations.update',
    'modules.view',
    'reports.view',
    'storefront.manage',
  ],
  INVENTORY_MANAGER: ['business.view', 'reports.view'],
  STAFF: ['business.view'],
};
