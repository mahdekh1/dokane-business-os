import { z } from 'zod';

export const MeBusiness = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: z.string(),
  role: z.string(),
  membershipId: z.string(),
});
export type MeBusiness = z.infer<typeof MeBusiness>;

export const MeResponse = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
  }),
  businesses: z.array(MeBusiness),
});
export type MeResponse = z.infer<typeof MeResponse>;
