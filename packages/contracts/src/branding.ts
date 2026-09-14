import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #0E6A57');

export const BrandingDto = z.object({
  primaryColor: z.string(),
  secondaryColor: z.string(),
  fontHeading: z.string(),
  fontBody: z.string(),
  logoUrl: z.string().nullable(),
});
export type BrandingDto = z.infer<typeof BrandingDto>;

export const UpdateBrandingInput = z.object({
  primaryColor: hex,
  secondaryColor: hex,
  fontHeading: z.string().min(1).max(60),
  fontBody: z.string().min(1).max(60),
  logoUrl: z.string().max(500).optional(),
});
export type UpdateBrandingInput = z.infer<typeof UpdateBrandingInput>;
