import { z } from 'zod';

export const BusinessStatusEnum = z.enum([
  'PENDING_APPROVAL',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
]);
export type BusinessStatus = z.infer<typeof BusinessStatusEnum>;

export const CreateBusinessInput = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens'),
  businessType: z.string().max(60).optional(),
  businessNumber: z.string().max(60).optional(),
  address: z.string().min(1).max(200),
  phone: z.string().min(3).max(40),
});
export type CreateBusinessInput = z.infer<typeof CreateBusinessInput>;

export const LifecycleNote = z.object({
  note: z.string().max(500).optional(),
});
export type LifecycleNote = z.infer<typeof LifecycleNote>;

export const BusinessDto = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: BusinessStatusEnum,
  businessType: z.string().nullable(),
  businessNumber: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  createdAt: z.string(),
});
export type BusinessDto = z.infer<typeof BusinessDto>;

/** Platform review view: business + its owner. */
export const PlatformBusinessDetail = BusinessDto.extend({
  owner: z
    .object({ name: z.string(), email: z.string() })
    .nullable(),
});
export type PlatformBusinessDetail = z.infer<typeof PlatformBusinessDetail>;
