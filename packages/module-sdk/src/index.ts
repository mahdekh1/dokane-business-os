/**
 * Module SDK — the contract every Dokane feature module declares.
 * See docs/MODULES.md. Backend implementations live in apps/api/src/modules/*.
 */
export const MODULE_SDK_VERSION = '1.0.0';

export interface ModuleNavItem {
  path: string;
  labelKey: string;
  icon?: string;
}

export interface ModuleEvents {
  emits?: string[];
  consumes?: string[];
}

export interface ModuleManifest {
  /** Stable module id, e.g. "catalog". */
  id: string;
  /** Human-readable name. */
  name: string;
  version: string;
  /** Module ids that must be enabled first. */
  dependsOn: string[];
  /** Entitlement key that unlocks this module (plan tier or add-on). */
  requiredEntitlement: string;
  /** Permission codes this module contributes to the RBAC catalog. */
  permissions: string[];
  navigation?: ModuleNavItem[];
  events?: ModuleEvents;
  /** AI-agent tool names this module offers. */
  agentTools?: string[];
}

/** Per-tenant availability of a module on the Modules page. */
export type ModuleState = 'active' | 'available' | 'locked';
