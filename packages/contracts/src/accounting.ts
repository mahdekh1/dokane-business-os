import { z } from 'zod';

/**
 * Cash-basis ledger (see docs/ORDERS_AND_MONEY.md §§6-7). A "sale" is simply an
 * INCOME entry — there is no parallel sales table. Income follows PAYMENT
 * RECEIVED, not order completion, so delivered-but-unpaid orders show as
 * receivables, not income.
 */
export const FINANCIAL_ENTRY_TYPES = ['INCOME', 'EXPENSE'] as const;
export const FinancialEntryTypeEnum = z.enum(FINANCIAL_ENTRY_TYPES);
export type FinancialEntryType = z.infer<typeof FinancialEntryTypeEnum>;

export const EntryMethodEnum = z.enum(['CASH', 'BIT']);

export const CreateFinancialEntryInput = z.object({
  type: FinancialEntryTypeEnum,
  amount: z.number().int().min(1).max(1_000_000_000),
  category: z.string().max(80).optional(),
  channelId: z.string().uuid().optional(),
  method: EntryMethodEnum.optional(),
  /** ISO date; defaults to now. */
  entryDate: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
});
export type CreateFinancialEntryInput = z.infer<typeof CreateFinancialEntryInput>;

export const FinancialEntryDto = z.object({
  id: z.string(),
  type: FinancialEntryTypeEnum,
  amount: z.number().int(),
  currency: z.string(),
  category: z.string().nullable(),
  channelId: z.string().nullable(),
  channelName: z.string().nullable(),
  method: z.string().nullable(),
  sourceType: z.string().nullable(),
  note: z.string().nullable(),
  entryDate: z.string(),
  createdAt: z.string(),
});
export type FinancialEntryDto = z.infer<typeof FinancialEntryDto>;

export const FinancialEntryListQuery = z.object({
  type: FinancialEntryTypeEnum.optional(),
  channelId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
export type FinancialEntryListQuery = z.infer<typeof FinancialEntryListQuery>;

export const FinancialEntryListResult = z.object({
  items: z.array(FinancialEntryDto),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type FinancialEntryListResult = z.infer<typeof FinancialEntryListResult>;

export const AccountingSummaryQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  channelId: z.string().optional(),
});
export type AccountingSummaryQuery = z.infer<typeof AccountingSummaryQuery>;

/** The three reconciled numbers, global or per-channel. */
export const AccountingSummaryDto = z.object({
  sales: z.number().int(), // value of COMPLETED orders (Axis A)
  income: z.number().int(), // cash collected = payments received (Axis B)
  expenses: z.number().int(),
  receivables: z.number().int(), // Σ amount_due on open orders
  net: z.number().int(), // income − expenses
  currency: z.string(),
});
export type AccountingSummaryDto = z.infer<typeof AccountingSummaryDto>;

export const ReceivableDto = z.object({
  orderId: z.string(),
  customerName: z.string().nullable(),
  channelName: z.string(),
  fulfillmentStatus: z.string(),
  total: z.number().int(),
  amountPaid: z.number().int(),
  amountDue: z.number().int(),
  currency: z.string(),
  createdAt: z.string(),
});
export type ReceivableDto = z.infer<typeof ReceivableDto>;

export const ReceivablesResult = z.object({
  items: z.array(ReceivableDto),
  totalDue: z.number().int(),
});
export type ReceivablesResult = z.infer<typeof ReceivablesResult>;
