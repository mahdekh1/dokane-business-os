'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LogoMark } from '../../src/components/logo';
import { api, ApiError } from '../../src/lib/api';
import { getToken, clearSession, setBusinessId } from '../../src/lib/session';
import { inputCls, labelCls, primaryBtnCls } from '../../src/lib/ui';
import { BUSINESS_CATEGORIES, OFFERING_TYPES, type BusinessCategory, type OfferingType } from '@dokane/contracts';

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    slug: '',
    email: '',
    category: 'retail' as BusinessCategory,
    categoryOther: '',
    offeringTypes: [] as OfferingType[],
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

  const toggleOffering = (key: OfferingType) =>
    setForm((f) => ({
      ...f,
      offeringTypes: f.offeringTypes.includes(key)
        ? f.offeringTypes.filter((o) => o !== key)
        : [...f.offeringTypes, key],
    }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (form.offeringTypes.length === 0) {
      setError('Pick at least one thing your business offers.');
      return;
    }
    setBusy(true);
    try {
      const biz = await api.createBusiness({
        name: form.name,
        slug: form.slug,
        email: form.email,
        category: form.category,
        categoryOther: form.category === 'other' ? form.categoryOther : undefined,
        offeringTypes: form.offeringTypes,
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
                <label className={labelCls} htmlFor="category">Business category</label>
                <select id="category" className={inputCls} value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as BusinessCategory })}>
                  {BUSINESS_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="bnum">Business ID</label>
                <input id="bnum" className={inputCls} placeholder="Registration / tax no." value={form.businessNumber} onChange={set('businessNumber')} />
              </div>
            </div>

            {form.category === 'other' && (
              <div className="mb-4">
                <label className={labelCls} htmlFor="categoryOther">Tell us your category</label>
                <input id="categoryOther" className={inputCls} placeholder="e.g. Bookstore, Bakery, Auto parts"
                  value={form.categoryOther} onChange={set('categoryOther')} required />
              </div>
            )}

            <div className="mb-4">
              <label className={labelCls}>What does your business offer? <span className="font-normal text-muted">(pick one or more)</span></label>
              <div className="grid grid-cols-2 gap-2.5">
                {OFFERING_TYPES.map((o) => {
                  const on = form.offeringTypes.includes(o.key);
                  return (
                    <button type="button" key={o.key} onClick={() => toggleOffering(o.key)}
                      aria-pressed={on}
                      className="flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors"
                      style={on
                        ? { borderColor: 'var(--brand)', background: 'color-mix(in srgb, var(--brand) 8%, transparent)' }
                        : { borderColor: 'var(--border)', background: 'var(--field)' }}>
                      <span className="mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center rounded-md border"
                        style={on ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: 'var(--on-brand)' } : { borderColor: 'var(--border)' }}>
                        {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      <span>
                        <b className="block text-[13.5px] font-semibold text-ink">{o.label}</b>
                        <span className="text-[12px] text-muted">{o.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="email">Business email</label>
                <input id="email" type="email" className={inputCls} placeholder="hello@yourshop.com" value={form.email} onChange={set('email')} required />
              </div>
              <div>
                <label className={labelCls} htmlFor="phone">Phone</label>
                <input id="phone" type="tel" className={inputCls} placeholder="+1 555 000 0000" value={form.phone} onChange={set('phone')} required />
              </div>
            </div>

            <div className="mb-5">
              <label className={labelCls} htmlFor="addr">Address</label>
              <input id="addr" className={inputCls} placeholder="123 Main St, City" value={form.address} onChange={set('address')} required />
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
