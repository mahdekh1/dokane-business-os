'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LogoMark } from '../../src/components/logo';
import { api, ApiError } from '../../src/lib/api';
import { getToken, clearSession, setBusinessId } from '../../src/lib/session';
import { inputCls, labelCls, primaryBtnCls } from '../../src/lib/ui';

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    slug: '',
    businessType: 'Store',
    businessNumber: '',
    address: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const biz = await api.createBusiness({
        name: form.name,
        slug: form.slug,
        businessType: form.businessType,
        businessNumber: form.businessNumber || undefined,
        address: form.address,
        phone: form.phone,
      });
      setBusinessId(biz.id);
      router.push('/dashboard');
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'SLUG_TAKEN'
          ? 'That store URL is taken. Try another.'
          : err instanceof ApiError && err.code === 'VALIDATION_ERROR'
            ? 'Check the highlighted fields and try again.'
            : 'Could not create your business. Try again.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="flex h-[60px] items-center justify-between border-b border-line bg-surface px-6">
        <span className="flex items-center gap-2.5 text-[17px] font-bold">
          <LogoMark size={26} /> Dokane
        </span>
        <button
          onClick={() => { clearSession(); router.replace('/login'); }}
          className="text-[13px] text-muted hover:text-ink"
        >
          Sign out
        </button>
      </header>

      <div className="flex justify-center px-5 py-9">
        <div className="w-full max-w-[520px]">
          <p className="mb-2 text-[12px] uppercase tracking-[.12em] text-muted">Step 1 of 2 · Your business</p>
          <h1 className="font-display text-[29px] font-medium tracking-tight">Set up your business</h1>
          <p className="mb-6 mt-1.5 text-[14.5px] text-muted">Tell us the basics. You can change any of this later.</p>

          {error && (
            <p className="mb-4 rounded-xl border border-[color:var(--brand)] bg-field px-4 py-3 text-[13.5px]" role="alert">
              {error}
            </p>
          )}

          <form onSubmit={onSubmit} noValidate className="rounded-[18px] border border-line bg-surface p-6">
            <div className="mb-4">
              <label className={labelCls} htmlFor="name">Business name</label>
              <input id="name" className={inputCls} placeholder="ABC Store" value={form.name} onChange={set('name')} required />
            </div>

            <div className="mb-1">
              <label className={labelCls} htmlFor="slug">Store URL</label>
              <div className="flex h-[46px] items-center rounded-xl border border-transparent bg-field px-3 focus-within:border-brand">
                <span className="whitespace-nowrap text-[14px] text-muted">dokane.com/</span>
                <input id="slug" className="h-11 flex-1 border-0 bg-transparent pl-0.5 text-[15px] text-ink outline-none"
                  placeholder="abc-store" value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} required />
              </div>
            </div>
            <p className="mb-4 mt-1.5 px-0.5 text-[12px] text-muted">Lowercase letters, numbers and hyphens.</p>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="type">Business type</label>
                <select id="type" className={inputCls} value={form.businessType} onChange={set('businessType')}>
                  <option>Store</option><option>Clinic</option><option>Services</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="bnum">Business ID</label>
                <input id="bnum" className={inputCls} placeholder="Registration / tax no." value={form.businessNumber} onChange={set('businessNumber')} />
              </div>
            </div>

            <div className="mb-4">
              <label className={labelCls} htmlFor="addr">Address</label>
              <input id="addr" className={inputCls} placeholder="123 Main St, City" value={form.address} onChange={set('address')} required />
            </div>
            <div className="mb-5">
              <label className={labelCls} htmlFor="phone">Phone</label>
              <input id="phone" type="tel" className={inputCls} placeholder="+1 555 000 0000" value={form.phone} onChange={set('phone')} required />
            </div>

            <div className="flex justify-end">
              <button type="submit" className={`${primaryBtnCls} w-auto px-6`} disabled={busy}>
                {busy ? 'Creating…' : 'Create business'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
