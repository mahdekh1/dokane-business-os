'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell } from '../../../src/components/auth-shell';
import { api, ApiError } from '../../../src/lib/api';
import { setTokens } from '../../../src/lib/session';
import { inputCls, labelCls, primaryBtnCls } from '../../../src/lib/ui';

const benefits = [
  'Create your account, then set up your business.',
  'Turn on only the modules you need — add more as you grow.',
  'Sell in store and online from one shared catalog.',
];

const panel = (
  <>
    <h1 className="max-w-[14ch] text-[38px] font-bold leading-[1.05] tracking-tight">
      Start selling in minutes.
    </h1>
    <ul className="mt-7 flex flex-col gap-3.5">
      {benefits.map((b) => (
        <li key={b} className="flex max-w-[36ch] items-start gap-3 text-[15px]" style={{ color: '#DCEAE4' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FE3CE" strokeWidth="2.2"
            className="mt-0.5 flex-none" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {b}
        </li>
      ))}
    </ul>
  </>
);

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const tokens = await api.signup(form);
      setTokens(tokens.accessToken, tokens.refreshToken);
      router.push('/dashboard');
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'EMAIL_TAKEN'
          ? 'That email is already registered.'
          : 'Could not create your account. Check your details and try again.',
      );
      setBusy(false);
    }
  }

  return (
    <AuthShell panel={panel}>
      <h1 className="text-[30px] font-bold tracking-tight">Create your account</h1>
      <p className="mb-6 mt-1.5 text-[14.5px] text-muted">One account runs every business you own or work in.</p>

      {error && (
        <p className="mb-4 rounded-xl border border-[color:var(--brand)] bg-field px-4 py-3 text-[13.5px]" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div className="mb-[15px]">
            <label className={labelCls} htmlFor="fn">First name</label>
            <input id="fn" className={inputCls} placeholder="Maya" value={form.firstName} onChange={set('firstName')} required />
          </div>
          <div className="mb-[15px]">
            <label className={labelCls} htmlFor="ln">Last name</label>
            <input id="ln" className={inputCls} placeholder="Haddad" value={form.lastName} onChange={set('lastName')} required />
          </div>
        </div>
        <div className="mb-[15px]">
          <label className={labelCls} htmlFor="em">Email</label>
          <input id="em" type="email" autoComplete="email" className={inputCls}
            placeholder="you@yourshop.com" value={form.email} onChange={set('email')} required />
        </div>
        <div className="mb-[15px]">
          <label className={labelCls} htmlFor="pw">Password</label>
          <input id="pw" type="password" autoComplete="new-password" className={inputCls}
            placeholder="Create a password" value={form.password} onChange={set('password')} required minLength={8} />
          <p className="mt-1.5 px-0.5 text-[12px] text-muted">At least 8 characters.</p>
        </div>
        <button type="submit" className={`${primaryBtnCls} mt-2`} disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="mt-3.5 text-center text-[12px] leading-relaxed text-muted">
          By continuing you agree to Dokane&rsquo;s <Link href="/terms" className="underline">Terms</Link> and{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </form>

      <p className="mt-5 text-center text-[14px] text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand hover:underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
