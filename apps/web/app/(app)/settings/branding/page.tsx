'use client';

import { useEffect, useState } from 'react';
import type { BrandingDto } from '@dokane/contracts';
import { api, ApiError } from '../../../../src/lib/api';
import { labelCls } from '../../../../src/lib/ui';

const FONTS = [
  'Fraunces', 'Hanken Grotesk', 'Playfair Display', 'Poppins', 'Space Grotesk',
  'Lora', 'DM Sans', 'Manrope', 'Sora', 'Inter',
];

function fontsUrl(families: string[]): string {
  const uniq = Array.from(new Set(families));
  const q = uniq.map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`).join('&');
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

export default function BrandingPage() {
  const [b, setB] = useState<BrandingDto | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { void api.branding.get().then(setB); }, []);

  // Load the selected fonts so the preview renders them.
  useEffect(() => {
    if (!b) return;
    const id = 'brand-preview-fonts';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = fontsUrl([b.fontHeading, b.fontBody]);
  }, [b]);

  if (!b) return <p className="text-[14px] text-muted">Loading…</p>;

  const set = (k: keyof BrandingDto, v: string) => { setB({ ...b, [k]: v }); setSaved(false); };

  async function save() {
    if (!b) return;
    setError('');
    setBusy(true);
    try {
      const next = await api.branding.update({
        primaryColor: b.primaryColor,
        secondaryColor: b.secondaryColor,
        fontHeading: b.fontHeading,
        fontBody: b.fontBody,
        logoUrl: b.logoUrl ?? undefined,
      });
      setB(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save branding.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[920px]">
      <h1 className="text-[24px] font-bold tracking-tight">Branding</h1>
      <p className="mb-6 mt-1 max-w-[60ch] text-[13.5px] text-muted">
        Your brand kit themes your public mini-site. (The console keeps the Dokane look.)
      </p>

      {error && <p className="mb-4 rounded-xl border border-[color:var(--accent)] bg-field px-4 py-3 text-[13.5px]" role="alert">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <ColorField label="Primary" value={b.primaryColor} onChange={(v) => set('primaryColor', v)} />
            <ColorField label="Secondary" value={b.secondaryColor} onChange={(v) => set('secondaryColor', v)} />
          </div>
          <div className="mb-4">
            <label className={labelCls}>Heading font</label>
            <select className={selectCls} value={b.fontHeading} onChange={(e) => set('fontHeading', e.target.value)}>
              {FONTS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="mb-4">
            <label className={labelCls}>Body font</label>
            <select className={selectCls} value={b.fontBody} onChange={(e) => set('fontBody', e.target.value)}>
              {FONTS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="mb-5">
            <label className={labelCls}>Logo URL <span className="font-normal text-muted">(optional)</span></label>
            <input className={selectCls} placeholder="https://…/logo.png" value={b.logoUrl ?? ''} onChange={(e) => set('logoUrl', e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={busy} className="rounded-full bg-brand px-5 py-2.5 text-[14px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            {saved && <span className="text-[13px] font-medium" style={{ color: 'var(--brand)' }}>Saved</span>}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[.1em] text-muted">Storefront preview</p>
          <Preview b={b} />
        </div>
      </div>
    </div>
  );
}

const selectCls = 'w-full h-[44px] rounded-xl bg-field border border-transparent px-3 text-[14.5px] text-ink outline-none focus:border-brand';

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex h-[44px] items-center gap-2 rounded-xl border border-transparent bg-field px-2 focus-within:border-brand">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-8 cursor-pointer rounded-md border-0 bg-transparent p-0" aria-label={`${label} colour`} />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full border-0 bg-transparent text-[13.5px] uppercase text-ink outline-none" />
      </div>
    </div>
  );
}

function Preview({ b }: { b: BrandingDto }) {
  const heading = { fontFamily: `"${b.fontHeading}", Georgia, serif` };
  const body = { fontFamily: `"${b.fontBody}", system-ui, sans-serif` };
  return (
    <div className="overflow-hidden rounded-2xl border border-line" style={body}>
      <div className="flex items-center justify-between px-5 py-3.5" style={{ background: b.primaryColor, color: '#fff' }}>
        <span className="flex items-center gap-2.5 font-semibold">
          {b.logoUrl
            ? <img src={b.logoUrl} alt="" className="h-6 w-6 rounded object-cover" />
            : <span className="grid h-6 w-6 place-items-center rounded bg-white/20 text-[12px]">◆</span>}
          Your Business
        </span>
        <span className="hidden gap-4 text-[13px] opacity-90 sm:flex"><span>Shop</span><span>About</span><span>Contact</span></span>
      </div>
      <div className="px-6 py-9" style={{ background: '#FBFAF7' }}>
        <span className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: b.secondaryColor, color: '#3a2408' }}>New season</span>
        <h2 className="mt-3 max-w-[16ch] text-[30px] font-semibold leading-[1.1]" style={{ ...heading, color: '#1a1a1a' }}>Everything for your everyday.</h2>
        <p className="mt-2 max-w-[40ch] text-[14px]" style={{ color: '#555' }}>Browse the collection and order online or in store.</p>
        <div className="mt-5 flex items-center gap-3">
          <button className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white" style={{ background: b.primaryColor }}>Shop now</button>
          <button className="rounded-full px-5 py-2.5 text-[14px] font-semibold" style={{ border: `1.5px solid ${b.primaryColor}`, color: b.primaryColor, background: 'transparent' }}>Learn more</button>
        </div>
      </div>
    </div>
  );
}
