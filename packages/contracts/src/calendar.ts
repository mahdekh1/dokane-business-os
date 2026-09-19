import { z } from 'zod';

/** Calendar — appointments/sessions (see docs/MODULES.md). External Google/
 *  Apple sync is scaffolded but dormant until provider credentials are set. */
export const APPOINTMENT_STATUSES = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
export const AppointmentStatusEnum = z.enum(APPOINTMENT_STATUSES);
export type AppointmentStatus = z.infer<typeof AppointmentStatusEnum>;

export const appointmentStatusLabel = (s: string): string =>
  ({ SCHEDULED: 'Scheduled', CONFIRMED: 'Confirmed', COMPLETED: 'Completed', CANCELLED: 'Cancelled', NO_SHOW: 'No-show' })[s] ?? s;

export const CreateAppointmentInput = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    customerId: z.string().uuid().optional(),
    assigneeId: z.string().uuid().optional(), // business membership id
    location: z.string().max(200).optional(),
    status: AppointmentStatusEnum.default('SCHEDULED'),
    note: z.string().max(2000).optional(),
  })
  .refine((a) => new Date(a.endsAt) > new Date(a.startsAt), { message: 'End must be after start.', path: ['endsAt'] });
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentInput>;

export const UpdateAppointmentInput = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  customerId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  status: AppointmentStatusEnum.optional(),
  note: z.string().max(2000).nullable().optional(),
});
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentInput>;

export const AppointmentDto = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: AppointmentStatusEnum,
  customerId: z.string().nullable(),
  customerName: z.string().nullable(),
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
  location: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AppointmentDto = z.infer<typeof AppointmentDto>;

export const AppointmentListQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: AppointmentStatusEnum.optional(),
  assigneeId: z.string().optional(),
  customerId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(100),
});
export type AppointmentListQuery = z.infer<typeof AppointmentListQuery>;

export const AppointmentListResult = z.object({
  items: z.array(AppointmentDto),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type AppointmentListResult = z.infer<typeof AppointmentListResult>;

// ---- external calendar connections (scaffold) ----

export const CALENDAR_PROVIDERS = ['GOOGLE', 'APPLE_CALDAV'] as const;
export const CalendarProviderEnum = z.enum(CALENDAR_PROVIDERS);
export type CalendarProvider = z.infer<typeof CalendarProviderEnum>;

export const calendarProviderLabel = (p: string): string =>
  ({ GOOGLE: 'Google Calendar', APPLE_CALDAV: 'Apple Calendar' })[p] ?? p;

export const CONNECTION_STATUSES = ['DISCONNECTED', 'CONNECTED', 'ERROR'] as const;
export const ConnectionStatusEnum = z.enum(CONNECTION_STATUSES);
export type ConnectionStatus = z.infer<typeof ConnectionStatusEnum>;

export const CalendarConnectionDto = z.object({
  provider: CalendarProviderEnum,
  status: ConnectionStatusEnum,
  accountEmail: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
  /** Whether this provider is configured server-side (OAuth creds present). */
  configured: z.boolean(),
});
export type CalendarConnectionDto = z.infer<typeof CalendarConnectionDto>;
