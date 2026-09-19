import { z } from 'zod';

/**
 * CRM leads — a lightweight pipeline layered ON TOP of the core customers
 * registry (CRM never owns customers). A lead converts by creating/linking a
 * core customer via getOrCreateByContact. See docs/MODULES.md (module boundaries).
 */
export const LEAD_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'] as const;
export const LeadStageEnum = z.enum(LEAD_STAGES);
export type LeadStage = z.infer<typeof LeadStageEnum>;

export const leadStageLabel = (s: string): string =>
  ({ NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified', CONVERTED: 'Converted', LOST: 'Lost' })[s] ?? s;

export const CreateLeadInput = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email().max(160).optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  source: z.string().max(60).optional(),
  /** Estimated deal value in integer minor units. */
  value: z.number().int().min(0).max(1_000_000_000).optional(),
  note: z.string().max(1000).optional(),
  stage: LeadStageEnum.default('NEW'),
});
export type CreateLeadInput = z.infer<typeof CreateLeadInput>;

export const UpdateLeadInput = z.object({
  name: z.string().min(1).max(160).optional(),
  email: z.string().email().max(160).nullable().optional().or(z.literal('')),
  phone: z.string().max(40).nullable().optional(),
  source: z.string().max(60).nullable().optional(),
  value: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  stage: LeadStageEnum.optional(),
});
export type UpdateLeadInput = z.infer<typeof UpdateLeadInput>;

export const LeadDto = z.object({
  id: z.string(),
  customerId: z.string().nullable(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  source: z.string().nullable(),
  value: z.number().int().nullable(),
  note: z.string().nullable(),
  stage: LeadStageEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LeadDto = z.infer<typeof LeadDto>;

export const LeadListQuery = z.object({
  q: z.string().max(120).optional(),
  stage: LeadStageEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type LeadListQuery = z.infer<typeof LeadListQuery>;

export const LeadListResult = z.object({
  items: z.array(LeadDto),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type LeadListResult = z.infer<typeof LeadListResult>;
