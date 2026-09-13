import { z } from 'zod';

/** Package version marker. Real per-module contracts are added in Phase 1+. */
export const CONTRACTS_VERSION = '0.0.0';

/** Health check response shape shared by the API and its consumers. */
export const HealthResponse = z.object({ status: z.literal('ok') });
export type HealthResponse = z.infer<typeof HealthResponse>;
