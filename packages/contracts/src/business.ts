import { z } from 'zod';

export const BusinessStatusEnum = z.enum([
  'PENDING_APPROVAL',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
]);
export type BusinessStatus = z.infer<typeof BusinessStatusEnum>;

/**
 * Business category taxonomy (agreed 2026-09-14). One required choice at
 * onboarding; `other` carries a free-text label. `suggests` lists module ids the
 * Modules page recommends for that kind of business (Task 2.5.3) — suggestions
 * only, always intersected with what the plan entitles. Stored in the
 * `businesses.businessType` column (the key, or the free text for `other`).
 */
export const BUSINESS_CATEGORIES = [
  { key: 'retail', label: 'Retail shop (general)', suggests: ['catalog', 'inventory', 'online_store', 'channels', 'mini_site'] },
  { key: 'grocery', label: 'Grocery / mini-market', suggests: ['catalog', 'inventory', 'online_store', 'notifications', 'mini_site'] },
  { key: 'pharmacy', label: 'Pharmacy', suggests: ['catalog', 'inventory', 'online_store', 'notifications', 'mini_site'] },
  { key: 'fashion', label: 'Fashion & apparel', suggests: ['catalog', 'inventory', 'online_store', 'mini_site'] },
  { key: 'restaurant', label: 'Restaurant / Café', suggests: ['catalog', 'online_store', 'notifications', 'mini_site'] },
  { key: 'beauty', label: 'Health & beauty / salon', suggests: ['catalog', 'online_store', 'crm', 'calendar', 'mini_site'] },
  { key: 'clinic', label: 'Clinic / services', suggests: ['calendar', 'crm', 'notifications', 'mini_site'] },
  { key: 'home_hardware', label: 'Home & hardware', suggests: ['catalog', 'inventory', 'online_store', 'mini_site'] },
  { key: 'other', label: 'Other', suggests: ['catalog', 'online_store', 'mini_site'] },
] as const;

export const BusinessCategoryEnum = z.enum(
  BUSINESS_CATEGORIES.map((c) => c.key) as [string, ...string[]],
);
export type BusinessCategory = z.infer<typeof BusinessCategoryEnum>;

/**
 * What a business *offers* — orthogonal to its category. A business can pick
 * several (a clinic may provide Services and sell Courses). Drives the Catalog
 * offering editor (Phase 3) and module suggestions. `suggests` lists module ids
 * recommended for that offering form.
 */
export const OFFERING_TYPES = [
  { key: 'physical', label: 'Physical goods', hint: 'Items you stock and ship (e.g. clothing).', suggests: ['catalog', 'inventory', 'online_store', 'channels'] },
  { key: 'services', label: 'Services', hint: 'Appointments or work you perform (e.g. a clinic, a salon).', suggests: ['services', 'calendar', 'crm'] },
  { key: 'courses', label: 'Courses & programs', hint: 'Enrollments, classes, memberships.', suggests: ['courses', 'calendar', 'crm'] },
  { key: 'digital', label: 'Digital products', hint: 'Downloadable or virtual goods (files, licenses).', suggests: ['catalog', 'online_store'] },
] as const;

export const OfferingTypeEnum = z.enum(
  OFFERING_TYPES.map((o) => o.key) as [string, ...string[]],
);
export type OfferingType = z.infer<typeof OfferingTypeEnum>;

export const offeringTypeLabel = (key: string): string =>
  OFFERING_TYPES.find((o) => o.key === key)?.label ?? key;

/** Module ids suggested for a set of offering types (union, unknown keys skipped). */
export function suggestedModulesForOfferings(types: readonly string[] | null | undefined): string[] {
  const out = new Set<string>();
  for (const t of types ?? []) {
    for (const m of OFFERING_TYPES.find((o) => o.key === t)?.suggests ?? []) out.add(m);
  }
  return [...out];
}

/** Human label for a stored category value (known key → label; free text → itself). */
export function categoryLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return BUSINESS_CATEGORIES.find((c) => c.key === value)?.label ?? value;
}

/** Module ids suggested for a stored category value (unknown/free text → []). */
export function suggestedModulesForCategory(value: string | null | undefined): string[] {
  if (!value) return [];
  return [...(BUSINESS_CATEGORIES.find((c) => c.key === value)?.suggests ?? [])];
}

export const CreateBusinessInput = z
  .object({
    name: z.string().min(1).max(120),
    slug: z
      .string()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens'),
    email: z.string().email().max(160),
    category: BusinessCategoryEnum,
    categoryOther: z.string().min(2).max(60).optional(),
    offeringTypes: z.array(OfferingTypeEnum).min(1, 'Pick at least one'),
    businessNumber: z.string().max(60).optional(),
    address: z.string().min(1).max(200),
    phone: z.string().min(3).max(40),
  })
  .refine((v) => v.category !== 'other' || (v.categoryOther?.trim().length ?? 0) >= 2, {
    message: 'Tell us your business category',
    path: ['categoryOther'],
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
  // `businessType` holds the category value (taxonomy key, or free text for
  // `other`); use `categoryLabel()` for display.
  businessType: z.string().nullable(),
  offeringTypes: z.array(z.string()),
  email: z.string().nullable(),
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
