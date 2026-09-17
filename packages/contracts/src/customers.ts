import { z } from 'zod';

export const CustomerSourceEnum = z.enum(['MANUAL', 'ONLINE', 'IMPORT']);
export type CustomerSource = z.infer<typeof CustomerSourceEnum>;

export const CreateCustomerInput = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email().max(160).optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  address: z.string().max(300).optional(),
  source: CustomerSourceEnum.default('MANUAL'),
});
export type CreateCustomerInput = z.infer<typeof CreateCustomerInput>;

export const UpdateCustomerInput = CreateCustomerInput.partial();
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInput>;

export const CustomerDto = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  source: CustomerSourceEnum,
  createdAt: z.string(),
});
export type CustomerDto = z.infer<typeof CustomerDto>;

export const CustomerListQuery = z.object({
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type CustomerListQuery = z.infer<typeof CustomerListQuery>;

export const CustomerListResult = z.object({
  items: z.array(CustomerDto),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type CustomerListResult = z.infer<typeof CustomerListResult>;
