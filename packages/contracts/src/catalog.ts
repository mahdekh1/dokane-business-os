import { z } from 'zod';

/**
 * Catalog = physical + digital **goods**. Services and Courses/Programs are their
 * own modules (bookings/enrollment), not catalog offerings.
 */
export const OFFERING_KINDS = [
  { key: 'physical', label: 'Physical good', hint: 'Stocked and shipped (e.g. clothing).' },
  { key: 'digital', label: 'Digital product', hint: 'Downloadable or virtual (files, licenses).' },
] as const;

export const OfferingKindEnum = z.enum(['physical', 'digital']);
export type OfferingKind = z.infer<typeof OfferingKindEnum>;

export const offeringKindLabel = (key: string): string =>
  OFFERING_KINDS.find((k) => k.key === key)?.label ?? key;

/**
 * Canonical variant key: attributes sorted by key, so `{color,size}` and
 * `{size,color}` produce the same key. NEVER match variants by `JSON.stringify`
 * (Postgres jsonb reorders object keys on write). API and web both use this.
 */
export function variantKey(attributes: Record<string, string>): string {
  return Object.keys(attributes)
    .sort()
    .map((k) => `${k}:${attributes[k]}`)
    .join('|');
}

/** Money is always integer minor units (e.g. cents/agorot), never floats. */
const minorUnits = z.number().int().min(0).max(1_000_000_000);

export const VariantInput = z.object({
  /** Present when editing an existing variant; absent for a new one. */
  id: z.string().uuid().optional(),
  name: z.string().max(120).optional(),
  sku: z.string().max(60).optional(),
  barcode: z.string().max(60).optional(),
  price: minorUnits,
  /** e.g. { size: 'M', color: 'Red' } — at least one attribute. */
  attributes: z.record(z.string().min(1), z.string().min(1)).refine((a) => Object.keys(a).length > 0, {
    message: 'A variant needs at least one attribute',
  }),
  active: z.boolean().default(true),
});
export type VariantInput = z.infer<typeof VariantInput>;

export const VariantDto = z.object({
  id: z.string(),
  name: z.string().nullable(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  price: z.number().int(),
  attributes: z.record(z.string(), z.string()),
  key: z.string(),
  active: z.boolean(),
});
export type VariantDto = z.infer<typeof VariantDto>;

export const OfferingMediaDto = z.object({
  id: z.string(),
  url: z.string(),
  sortOrder: z.number().int(),
  altText: z.string().nullable(),
});
export type OfferingMediaDto = z.infer<typeof OfferingMediaDto>;

const offeringCore = {
  type: OfferingKindEnum,
  name: z.string().min(1).max(160),
  description: z.string().max(4000).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  sku: z.string().max(60).optional(),
  barcode: z.string().max(60).optional(),
  price: minorUnits,
  cost: minorUnits.optional(),
  /** Defaults server-side: physical → true, digital → false. */
  trackInventory: z.boolean().optional(),
  active: z.boolean().default(true),
  /** Empty = a simple offering; non-empty = a variant matrix. */
  variants: z.array(VariantInput).max(200).default([]),
};

export const CreateOfferingInput = z.object(offeringCore);
export type CreateOfferingInput = z.infer<typeof CreateOfferingInput>;

export const UpdateOfferingInput = z.object(offeringCore).partial();
export type UpdateOfferingInput = z.infer<typeof UpdateOfferingInput>;

export const OfferingDto = z.object({
  id: z.string(),
  type: OfferingKindEnum,
  name: z.string(),
  description: z.string().nullable(),
  categoryId: z.string().nullable(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  price: z.number().int(),
  cost: z.number().int().nullable(),
  trackInventory: z.boolean(),
  active: z.boolean(),
  variants: z.array(VariantDto),
  media: z.array(OfferingMediaDto),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OfferingDto = z.infer<typeof OfferingDto>;

export const OfferingListQuery = z.object({
  q: z.string().max(120).optional(),
  type: OfferingKindEnum.optional(),
  categoryId: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type OfferingListQuery = z.infer<typeof OfferingListQuery>;

export const OfferingListResult = z.object({
  items: z.array(OfferingDto),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type OfferingListResult = z.infer<typeof OfferingListResult>;

/** Categories (hierarchical-capable; MVP UI is flat). */
export const CreateCategoryInput = z.object({
  name: z.string().min(1).max(80),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens')
    .optional(),
  description: z.string().max(500).optional(),
  parentId: z.string().uuid().nullable().optional(),
  active: z.boolean().default(true),
});
export type CreateCategoryInput = z.infer<typeof CreateCategoryInput>;

export const CategoryDto = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  parentId: z.string().nullable(),
  active: z.boolean(),
});
export type CategoryDto = z.infer<typeof CategoryDto>;
