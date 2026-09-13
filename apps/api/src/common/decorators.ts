import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { TenantContext } from './tenant-context';

/** Marks a route as not requiring authentication. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

/** Requires a resolved tenant context (a valid membership + X-Business-Id). */
export const REQUIRE_BUSINESS_KEY = 'requireBusiness';
export const RequireBusiness = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_BUSINESS_KEY, true);

/** Requires a specific permission within the resolved tenant. Implies business. */
export const PERMISSION_KEY = 'requirePermission';
export const RequirePermission = (code: string): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSION_KEY, code);

/** Requires the tenant to be entitled to a module (plan/add-on). */
export const ENTITLEMENT_KEY = 'requireEntitlement';
export const RequireEntitlement = (key: string): MethodDecorator & ClassDecorator =>
  SetMetadata(ENTITLEMENT_KEY, key);

/** Injects the resolved TenantContext into a handler parameter. */
export const Ctx = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext =>
    context.switchToHttp().getRequest<{ tenant: TenantContext }>().tenant,
);
