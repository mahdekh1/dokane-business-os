import { z } from 'zod';

export const CreateRoleInput = z.object({
  name: z.string().min(1).max(80),
  permissions: z.array(z.string().min(1)).default([]),
});
export type CreateRoleInput = z.infer<typeof CreateRoleInput>;

export const RoleDto = z.object({
  id: z.string(),
  name: z.string(),
  scope: z.enum(['PLATFORM', 'BUSINESS']),
  isSystem: z.boolean(),
  businessId: z.string().nullable(),
  permissions: z.array(z.string()),
});
export type RoleDto = z.infer<typeof RoleDto>;
