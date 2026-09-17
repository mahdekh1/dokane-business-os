import { z } from 'zod';

export const MovementTypeEnum = z.enum([
  'INITIAL_STOCK',
  'ADJUSTMENT',
  'SALE',
  'RETURN',
  'TRANSFER_IN',
  'TRANSFER_OUT',
]);
export type MovementType = z.infer<typeof MovementTypeEnum>;

/**
 * Manual stock change. Exactly one of offeringId / variantId identifies the
 * stockable item. `delta` may be negative (never drives quantity below 0 — the
 * API rejects that). Orders (Phase 4) call the same service path with SALE/RETURN.
 */
export const AdjustStockInput = z
  .object({
    offeringId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    delta: z.number().int().min(-1_000_000).max(1_000_000),
    movementType: z.enum(['INITIAL_STOCK', 'ADJUSTMENT']).default('ADJUSTMENT'),
    reason: z.string().max(200).optional(),
    lowStockThreshold: z.number().int().min(0).max(1_000_000).optional(),
  })
  .refine((v) => Boolean(v.offeringId) !== Boolean(v.variantId), {
    message: 'Provide exactly one of offeringId or variantId',
    path: ['offeringId'],
  });
export type AdjustStockInput = z.infer<typeof AdjustStockInput>;

export const InventoryItemDto = z.object({
  id: z.string(),
  locationId: z.string(),
  locationName: z.string(),
  offeringId: z.string().nullable(),
  variantId: z.string().nullable(),
  label: z.string(),
  quantity: z.number().int(),
  lowStockThreshold: z.number().int().nullable(),
  lowStock: z.boolean(),
});
export type InventoryItemDto = z.infer<typeof InventoryItemDto>;

export const InventoryListQuery = z.object({
  locationId: z.string().optional(),
  lowStock: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type InventoryListQuery = z.infer<typeof InventoryListQuery>;

export const InventoryListResult = z.object({
  items: z.array(InventoryItemDto),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type InventoryListResult = z.infer<typeof InventoryListResult>;

export const MovementDto = z.object({
  id: z.string(),
  locationId: z.string(),
  offeringId: z.string().nullable(),
  variantId: z.string().nullable(),
  movementType: MovementTypeEnum,
  quantityDelta: z.number().int(),
  reason: z.string().nullable(),
  createdAt: z.string(),
});
export type MovementDto = z.infer<typeof MovementDto>;

export const MovementListQuery = z.object({
  offeringId: z.string().optional(),
  variantId: z.string().optional(),
  locationId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type MovementListQuery = z.infer<typeof MovementListQuery>;

export const MovementListResult = z.object({
  items: z.array(MovementDto),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type MovementListResult = z.infer<typeof MovementListResult>;

export const LocationDto = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  isDefault: z.boolean(),
});
export type LocationDto = z.infer<typeof LocationDto>;
