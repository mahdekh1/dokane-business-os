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
  currency: z.string().length(3).default('USD'),
  timezone: z.string().max(60).default('UTC'),
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
  currency: z.string(),
  timezone: z.string(),
  createdAt: z.string(),
});
export type BusinessDto = z.infer<typeof BusinessDto>;
