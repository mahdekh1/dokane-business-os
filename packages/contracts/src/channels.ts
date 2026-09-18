import { z } from 'zod';

/**
 * Sales channels — the "where you sell" surface. Every order references one.
 * ONLINE_STORE is self-serve (entry_mode ONLINE) and decrements stock from its
 * `fulfillmentLocationId`; PHYSICAL is a staffed store tied to a `locationId`;
 * MARKETPLACE is an external listing surface.
 */
export const CHANNEL_TYPES = ['ONLINE_STORE', 'PHYSICAL', 'MARKETPLACE'] as const;
export const ChannelTypeEnum = z.enum(CHANNEL_TYPES);
export type ChannelType = z.infer<typeof ChannelTypeEnum>;

export const channelTypeLabel = (t: string): string =>
  ({ ONLINE_STORE: 'Online store', PHYSICAL: 'In-store', MARKETPLACE: 'Marketplace' })[t] ?? t;

const channelCore = {
  type: ChannelTypeEnum,
  name: z.string().min(1).max(80),
  locationId: z.string().uuid().nullable().optional(),
  fulfillmentLocationId: z.string().uuid().nullable().optional(),
  settings: z.record(z.unknown()).optional(),
  active: z.boolean().default(true),
};

export const CreateChannelInput = z
  .object(channelCore)
  .refine((c) => c.type !== 'ONLINE_STORE' || Boolean(c.fulfillmentLocationId), {
    message: 'An online store needs a fulfillment location (its stock source).',
    path: ['fulfillmentLocationId'],
  });
export type CreateChannelInput = z.infer<typeof CreateChannelInput>;

export const UpdateChannelInput = z.object({
  name: z.string().min(1).max(80).optional(),
  locationId: z.string().uuid().nullable().optional(),
  fulfillmentLocationId: z.string().uuid().nullable().optional(),
  settings: z.record(z.unknown()).optional(),
  active: z.boolean().optional(),
});
export type UpdateChannelInput = z.infer<typeof UpdateChannelInput>;

export const ChannelDto = z.object({
  id: z.string(),
  type: ChannelTypeEnum,
  name: z.string(),
  locationId: z.string().nullable(),
  fulfillmentLocationId: z.string().nullable(),
  isDefault: z.boolean(),
  active: z.boolean(),
});
export type ChannelDto = z.infer<typeof ChannelDto>;
