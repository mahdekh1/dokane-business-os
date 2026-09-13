'use client';

import type {
  AuthTokens,
  LoginInput,
  MeResponse,
  SignupInput,
} from '@dokane/contracts';
import { getToken, getBusinessId } from './session';

const BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

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

export interface ModuleView {
  id: string;
  name: string;
  requiredEntitlement: string;
  dependsOn: string[];
  state: 'active' | 'available' | 'locked';
}

export const api = {
  login: (input: LoginInput) =>
    apiFetch<AuthTokens>('/auth/login', { method: 'POST', body: input, noBusiness: true }),
  signup: (input: SignupInput) =>
    apiFetch<AuthTokens>('/auth/signup', { method: 'POST', body: input, noBusiness: true }),
  me: () => apiFetch<MeResponse>('/me', { noBusiness: true }),
  modules: () => apiFetch<ModuleView[]>('/modules'),
};
