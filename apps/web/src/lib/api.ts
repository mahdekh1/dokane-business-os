'use client';

import type {
  AuthTokens,
  BrandingDto,
  BusinessDto,
  CategoryDto,
  ChangePasswordInput,
  AdjustStockInput,
  CreateBusinessInput,
  CreateCategoryInput,
  CreateOfferingInput,
  InventoryItemDto,
  InventoryListResult,
  LocationDto,
  LoginInput,
  MovementListResult,
  MeResponse,
  OfferingDto,
  OfferingListResult,
  PlanSummary,
  PlatformBusinessDetail,
  SignupInput,
  UpdateBrandingInput,
  UpdateOfferingInput,
  UpdateProfileInput,
} from '@dokane/contracts';
import { getToken, getBusinessId } from './session';

const BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/** API origin (base without the `/api/v1` suffix). Empty when the base is
 * relative (same-origin production), so resolved URLs stay relative there. */
const API_ORIGIN = BASE.replace(/\/api\/v1\/?$/, '');

/**
 * Resolve a server-returned media path (`/api/v1/public/media/…`) to a URL the
 * browser can load. In dev the web (:3000) and API (:3001) are different
 * origins, so a relative path would hit the web server; prepend the API origin.
 * In production the base is relative, so this returns the path unchanged.
 */
export function mediaUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

interface Options {
  method?: string;
  body?: unknown;
  /** Skip attaching the X-Business-Id header (for tenant-agnostic routes). */
  noBusiness?: boolean;
}

export async function apiFetch<T>(path: string, opts: Options = {}): Promise<T> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!opts.noBusiness) {
    const biz = getBusinessId();
    if (biz) headers.set('X-Business-Id', biz);
  }
  if (opts.body !== undefined) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    throw new ApiError(
      res.status,
      data.code ?? 'ERROR',
      data.message ?? `Request failed (${res.status})`,
    );
  }
  return res.status === 204 ? (null as T) : ((await res.json()) as T);
}

/** Multipart upload (FormData) — do NOT set Content-Type; the browser adds the boundary. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const biz = getBusinessId();
  if (biz) headers.set('X-Business-Id', biz);
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new ApiError(res.status, data.code ?? 'ERROR', data.message ?? `Upload failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export interface ModuleView {
  id: string;
  name: string;
  requiredEntitlement: string;
  dependsOn: string[];
  state: 'active' | 'available' | 'locked';
  suggested: boolean;
}

export const api = {
  login: (input: LoginInput) =>
    apiFetch<AuthTokens>('/auth/login', { method: 'POST', body: input, noBusiness: true }),
  signup: (input: SignupInput) =>
    apiFetch<AuthTokens>('/auth/signup', { method: 'POST', body: input, noBusiness: true }),
  me: () => apiFetch<MeResponse>('/me', { noBusiness: true }),
  updateProfile: (input: UpdateProfileInput) =>
    apiFetch<MeResponse>('/me', { method: 'PATCH', body: input, noBusiness: true }),
  changePassword: (input: ChangePasswordInput) =>
    apiFetch<void>('/me/password', { method: 'POST', body: input, noBusiness: true }),
  modules: () => apiFetch<ModuleView[]>('/modules'),
  enableModule: (id: string) => apiFetch<ModuleView>(`/modules/${id}/enable`, { method: 'POST' }),
  plan: () => apiFetch<PlanSummary>('/billing/plan'),

  branding: {
    get: () => apiFetch<BrandingDto>('/branding'),
    update: (input: UpdateBrandingInput) =>
      apiFetch<BrandingDto>('/branding', { method: 'PATCH', body: input }),
  },

  catalog: {
    list: (q: Record<string, string | number | undefined> = {}) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') qs.set(k, String(v));
      const s = qs.toString();
      return apiFetch<OfferingListResult>(`/catalog/offerings${s ? `?${s}` : ''}`);
    },
    get: (id: string) => apiFetch<OfferingDto>(`/catalog/offerings/${id}`),
    create: (input: CreateOfferingInput) =>
      apiFetch<OfferingDto>('/catalog/offerings', { method: 'POST', body: input }),
    update: (id: string, input: UpdateOfferingInput) =>
      apiFetch<OfferingDto>(`/catalog/offerings/${id}`, { method: 'PATCH', body: input }),
    archive: (id: string) => apiFetch<OfferingDto>(`/catalog/offerings/${id}`, { method: 'DELETE' }),
    uploadMedia: (id: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return apiUpload<OfferingDto>(`/catalog/offerings/${id}/media`, fd);
    },
    categories: {
      list: () => apiFetch<CategoryDto[]>('/catalog/categories'),
      create: (input: CreateCategoryInput) =>
        apiFetch<CategoryDto>('/catalog/categories', { method: 'POST', body: input }),
    },
  },

  inventory: {
    list: (q: Record<string, string | number | undefined> = {}) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') qs.set(k, String(v));
      const s = qs.toString();
      return apiFetch<InventoryListResult>(`/inventory${s ? `?${s}` : ''}`);
    },
    movements: (q: Record<string, string | number | undefined> = {}) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') qs.set(k, String(v));
      const s = qs.toString();
      return apiFetch<MovementListResult>(`/inventory/movements${s ? `?${s}` : ''}`);
    },
    locations: () => apiFetch<LocationDto[]>('/inventory/locations'),
    adjust: (input: AdjustStockInput) =>
      apiFetch<InventoryItemDto>('/inventory/adjustments', { method: 'POST', body: input }),
  },

  createBusiness: (input: CreateBusinessInput) =>
    apiFetch<BusinessDto>('/business', { method: 'POST', body: input, noBusiness: true }),

  platform: {
    list: (status?: string) =>
      apiFetch<BusinessDto[]>(
        `/platform/businesses${status ? `?status=${status}` : ''}`,
        { noBusiness: true },
      ),
    get: (id: string) =>
      apiFetch<PlatformBusinessDetail>(`/platform/businesses/${id}`, { noBusiness: true }),
    approve: (id: string) =>
      apiFetch<BusinessDto>(`/platform/businesses/${id}/approve`, { method: 'POST', noBusiness: true }),
    reject: (id: string, note?: string) =>
      apiFetch<BusinessDto>(`/platform/businesses/${id}/reject`, { method: 'POST', body: { note }, noBusiness: true }),
    requestChanges: (id: string, note?: string) =>
      apiFetch<BusinessDto>(`/platform/businesses/${id}/request-changes`, { method: 'POST', body: { note }, noBusiness: true }),
    suspend: (id: string, note?: string) =>
      apiFetch<BusinessDto>(`/platform/businesses/${id}/suspend`, { method: 'POST', body: { note }, noBusiness: true }),
    reactivate: (id: string) =>
      apiFetch<BusinessDto>(`/platform/businesses/${id}/reactivate`, { method: 'POST', noBusiness: true }),
  },
};
