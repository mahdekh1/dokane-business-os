'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell } from '../../../src/components/auth-shell';
import { api, ApiError } from '../../../src/lib/api';
import { setTokens, setBusinessId } from '../../../src/lib/session';
import { inputCls, labelCls, primaryBtnCls } from '../../../src/lib/ui';

const panel = (
  <>
    <h1 className="max-w-[13ch] text-[38px] font-bold leading-[1.05] tracking-tight">
      Sell everywhere. Manage in one place.
    </h1>
    <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed" style={{ color: '#B7D2C9' }}>
      POS, online store, inventory, customers and money — one modular platform that grows with you.
    </p>
    <div className="mt-7 flex flex-wrap gap-2">
      {['Online store', 'Inventory', 'CRM', 'Accounting'].map((c) => (
        <span
          key={c}
          className="rounded-full border px-3 py-1.5 text-[12px]"
          style={{ borderColor: 'rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)' }}
        >
          {c}
        </span>
      ))}
    </div>
  </>
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const tokens = await api.login({ email, password });
      setTokens(tokens.accessToken, tokens.refreshToken);
      const me = await api.me();
      if (me.businesses[0]) setBusinessId(me.businesses[0].id);
      router.push('/dashboard');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Invalid email or password.'
          : 'Something went wrong. Try again.',
      );
      setBusy(false);
    }
  }

  return (
    <AuthShell panel={panel}>
      <h1 className="text-[30px] font-bold tracking-tight">Welcome back</h1>
      <p className="mb-6 mt-1.5 text-[14.5px] text-muted">Log in to your Dokane workspace.</p>

      {error && (
        <p className="mb-4 rounded-xl border border-[color:var(--brand)] bg-field px-4 py-3 text-[13.5px]" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} noValidate>
        <div className="mb-[15px]">
          <label className={labelCls} htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" className={inputCls}
            placeholder="you@yourshop.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="mb-[15px]">
          <label className={labelCls} htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" className={inputCls}
            placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="mb-[18px] flex justify-end">
          <Link href="/forgot" className="text-[13px] font-medium text-brand hover:underline">Forgot password?</Link>
        </div>
        <button type="submit" className={primaryBtnCls} disabled={busy}>
          {busy ? 'Signing in…' : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-[14px] text-muted">
        New here?{' '}
        <Link href="/signup" className="font-semibold text-brand hover:underline">Create a business</Link>
      </p>
    </AuthShell>
  );
}
