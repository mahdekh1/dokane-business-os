import { z } from 'zod';

export const ModuleStateEnum = z.enum(['active', 'available', 'locked']);
export type ModuleState = z.infer<typeof ModuleStateEnum>;

export const ModuleViewDto = z.object({
  id: z.string(),
  name: z.string(),
  requiredEntitlement: z.string(),
  dependsOn: z.array(z.string()),
  state: ModuleStateEnum,
  /** Recommended for this business's category (Task 2.5.3); a UI hint only. */
  suggested: z.boolean(),
});
export type ModuleViewDto = z.infer<typeof ModuleViewDto>;

export const PlanSummary = z.object({
  tier: z.string(),
  name: z.string(),
});
export type PlanSummary = z.infer<typeof PlanSummary>;
