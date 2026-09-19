import { z } from 'zod';

/** A member of the business — used to assign work (PM tasks, project owners). */
export const TeamMemberDto = z.object({
  membershipId: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
});
export type TeamMemberDto = z.infer<typeof TeamMemberDto>;
