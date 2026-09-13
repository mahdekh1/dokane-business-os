'use client';

const TOKEN = 'dokane_token';
const REFRESH = 'dokane_refresh';
const BUSINESS = 'dokane_business';

/**
 * Client-side session storage. localStorage is a per-viewer convenience for the
 * MVP; the production hardening path is httpOnly cookies set by a route handler
 * (see docs/POST_MVP_CHANGES.md — auth). All reads are guarded for SSR/private mode.
 */
function read(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export const getToken = (): string | null => read(TOKEN);
export const getBusinessId = (): string | null => read(BUSINESS);

export function setTokens(accessToken: string, refreshToken: string): void {
  write(TOKEN, accessToken);
  write(REFRESH, refreshToken);
}

export function setBusinessId(id: string | null): void {
  write(BUSINESS, id);
}

export function clearSession(): void {
  write(TOKEN, null);
  write(REFRESH, null);
  write(BUSINESS, null);
}
