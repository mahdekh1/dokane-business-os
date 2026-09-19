import { z } from 'zod';

/**
 * Two-axis order status (see docs/ORDERS_AND_MONEY.md §3). Axis A is fulfillment
 * (a lifecycle the caller drives); Axis B is payment, always DERIVED from the
 * order's payment records — never set directly.
 */
export const FULFILLMENT_STATUSES = [
  'DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'COMPLETED', 'CANCELLED',
] as const;
export const FulfillmentStatusEnum = z.enum(FULFILLMENT_STATUSES);
export type FulfillmentStatus = z.infer<typeof FulfillmentStatusEnum>;

export const PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'] as const;
export const PaymentStatusEnum = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

export const ENTRY_MODES = ['ONLINE', 'MANUAL'] as const;
export const EntryModeEnum = z.enum(ENTRY_MODES);
export type EntryMode = z.infer<typeof EntryModeEnum>;

export const PAYMENT_METHODS = ['CASH', 'BIT'] as const;
export const PaymentMethodEnum = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export const fulfillmentStatusLabel = (s: string): string =>
  ({
    DRAFT: 'Draft', PENDING: 'Pending', CONFIRMED: 'Confirmed', PROCESSING: 'Processing',
    READY: 'Ready', SHIPPED: 'Shipped', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
  })[s] ?? s;
export const paymentStatusLabel = (s: string): string =>
  ({
    UNPAID: 'Unpaid', PARTIALLY_PAID: 'Partially paid', PAID: 'Paid',
    REFUNDED: 'Refunded', PARTIALLY_REFUNDED: 'Partially refunded',
  })[s] ?? s;

/**
 * Fulfillment states that consume stock. The FIRST transition into any of these
 * decrements inventory (once); cancelling a committed order returns it. See
 * docs/ORDERS_AND_MONEY.md §9 and Task 4.4.
 */
export const STOCK_CONSUMING_STATUSES: FulfillmentStatus[] = ['PROCESSING', 'READY', 'SHIPPED', 'COMPLETED'];
export const consumesStock = (s: FulfillmentStatus): boolean => STOCK_CONSUMING_STATUSES.includes(s);

const FORWARD_SEQUENCE: FulfillmentStatus[] = ['DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'COMPLETED'];
const ONLINE_NEXT: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY', 'SHIPPED', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
  SHIPPED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Allowed fulfillment transitions from `current`. Online orders follow the flow
 * one step at a time; manual entries may fast-path forward (a counter sale can
 * jump straight to COMPLETED). Both may CANCELLED unless already terminal.
 */
export function allowedFulfillmentTransitions(entryMode: EntryMode, current: FulfillmentStatus): FulfillmentStatus[] {
  if (entryMode === 'ONLINE') return ONLINE_NEXT[current];
  if (current === 'COMPLETED' || current === 'CANCELLED') return [];
  const idx = FORWARD_SEQUENCE.indexOf(current);
  return [...FORWARD_SEQUENCE.slice(idx + 1), 'CANCELLED'];
}

// ---- inputs ----

const nonNegInt = z.number().int().min(0).max(1_000_000_000);

export const CreateOrderItemInput = z
  .object({
    offeringId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    quantity: z.number().int().min(1).max(100_000),
    discount: nonNegInt.default(0),
  })
  .refine((i) => Boolean(i.offeringId) !== Boolean(i.variantId), {
    message: 'Provide exactly one of offeringId or variantId',
    path: ['offeringId'],
  });
export type CreateOrderItemInput = z.infer<typeof CreateOrderItemInput>;

/**
 * Customer on an order, three ways:
 *  - `customerId`            → link an existing customer (its name is snapshotted).
 *  - name/email/phone        → create + link (deduped by email/phone) when `save`
 *                              is not false; the resolved name is snapshotted.
 *  - `name` with `save:false`→ ephemeral — snapshot the name only, no record
 *                              (a walk-in label; avoids duplicate throwaway rows).
 */
export const OrderCustomerInput = z.object({
  customerId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  name: z.string().max(160).optional(),
  save: z.boolean().optional(),
});
export type OrderCustomerInput = z.infer<typeof OrderCustomerInput>;

/** Fulfillment states an order may be CREATED in (never CANCELLED). Online is
 *  forced to PENDING server-side regardless of what's passed. */
export const CreatableFulfillmentEnum = z.enum(['DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'COMPLETED']);

export const CreateOrderInput = z.object({
  channelId: z.string().uuid().optional(),
  customer: OrderCustomerInput.optional(),
  items: z.array(CreateOrderItemInput).min(1).max(200),
  discount: nonNegInt.default(0),
  /** Initial fulfillment status (manual only; online is forced to PENDING). */
  fulfillmentStatus: CreatableFulfillmentEnum.optional(),
  note: z.string().max(1000).optional(),
});
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;

export const TransitionOrderInput = z.object({ fulfillmentStatus: FulfillmentStatusEnum });
export type TransitionOrderInput = z.infer<typeof TransitionOrderInput>;

export const RecordPaymentInput = z.object({
  amount: z.number().int().min(1).max(1_000_000_000),
  method: PaymentMethodEnum,
  reference: z.string().max(200).optional(),
});
export type RecordPaymentInput = z.infer<typeof RecordPaymentInput>;

// ---- DTOs ----

export const OrderItemDto = z.object({
  id: z.string(),
  offeringId: z.string().nullable(),
  variantId: z.string().nullable(),
  nameSnapshot: z.string(),
  skuSnapshot: z.string().nullable(),
  unitPrice: z.number().int(),
  quantity: z.number().int(),
  discount: z.number().int(),
  lineTotal: z.number().int(),
});
export type OrderItemDto = z.infer<typeof OrderItemDto>;

export const PaymentDto = z.object({
  id: z.string(),
  method: PaymentMethodEnum,
  amount: z.number().int(),
  currency: z.string(),
  reference: z.string().nullable(),
  status: z.enum(['RECEIVED', 'REFUNDED']),
  receivedAt: z.string(),
});
export type PaymentDto = z.infer<typeof PaymentDto>;

export const OrderDto = z.object({
  id: z.string(),
  channelId: z.string(),
  channelName: z.string(),
  channelType: z.string(),
  locationId: z.string().nullable(),
  customerId: z.string().nullable(),
  customerName: z.string().nullable(),
  entryMode: EntryModeEnum,
  fulfillmentStatus: FulfillmentStatusEnum,
  paymentStatus: PaymentStatusEnum,
  subtotal: z.number().int(),
  discount: z.number().int(),
  taxAmount: z.number().int(),
  total: z.number().int(),
  amountPaid: z.number().int(),
  amountDue: z.number().int(),
  currency: z.string(),
  note: z.string().nullable(),
  items: z.array(OrderItemDto),
  payments: z.array(PaymentDto),
  allowedTransitions: z.array(FulfillmentStatusEnum),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OrderDto = z.infer<typeof OrderDto>;

export const OrderSummaryDto = z.object({
  id: z.string(),
  channelName: z.string(),
  channelType: z.string(),
  customerName: z.string().nullable(),
  entryMode: EntryModeEnum,
  fulfillmentStatus: FulfillmentStatusEnum,
  paymentStatus: PaymentStatusEnum,
  itemCount: z.number().int(),
  total: z.number().int(),
  amountDue: z.number().int(),
  currency: z.string(),
  createdAt: z.string(),
});
export type OrderSummaryDto = z.infer<typeof OrderSummaryDto>;

export const OrderListQuery = z.object({
  channelId: z.string().optional(),
  customerId: z.string().optional(),
  fulfillmentStatus: FulfillmentStatusEnum.optional(),
  paymentStatus: PaymentStatusEnum.optional(),
  entryMode: EntryModeEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type OrderListQuery = z.infer<typeof OrderListQuery>;

export const OrderListResult = z.object({
  items: z.array(OrderSummaryDto),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type OrderListResult = z.infer<typeof OrderListResult>;

/** Derive Axis B from money. */
export function derivePaymentStatus(amountPaid: number, total: number): PaymentStatus {
  if (amountPaid <= 0) return 'UNPAID';
  if (amountPaid < total) return 'PARTIALLY_PAID';
  return 'PAID';
}
