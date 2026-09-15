'use client';

import { useEffect, useState } from 'react';
import { UPDATE_PROFILE_LANGUAGES, type MeResponse, type UserLanguage } from '@dokane/contracts';
import { api, ApiError } from '../lib/api';
import { inputCls, labelCls } from '../lib/ui';

const selectCls =
  'w-full h-[50px] rounded-[13px] bg-field border border-transparent px-[15px] text-[15px] text-ink outline-none transition-colors focus:border-brand';

export function AccountPanel() {
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => { void api.me().then(setMe); }, []);

  if (!me) return <p className="text-[14px] text-muted">Loading…</p>;

  return (
    <div className="max-w-[640px]">
      <h1 className="text-[24px] font-bold tracking-tight">Account</h1>
      <p className="mb-6 mt-1 text-[13.5px] text-muted">Your personal profile and sign-in. Separate from business settings.</p>

      <ProfileCard me={me} onSaved={setMe} />
      <PasswordCard />
    </div>
  );
}

function ProfileCard({ me, onSaved }: { me: MeResponse; onSaved: (m: MeResponse) => void }) {
  const [form, setForm] = useState({
    firstName: me.user.firstName,
    lastName: me.user.lastName,
    phone: me.user.phone ?? '',
    language: (me.user.language as UserLanguage) ?? 'en',
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) => { setForm({ ...form, [k]: v }); setSaved(false); };

  async function save() {
    setError('');
    setBusy(true);
    try {
      const next = await api.updateProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        language: form.language,
      });
      onSaved(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-4 rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-[16px] font-semibold">Profile</h2>
      {error && <p className="mb-4 rounded-xl border border-[color:var(--accent)] bg-field px-4 py-3 text-[13.5px]" role="alert">{error}</p>}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="firstName">First name</label>
          <input id="firstName" className={inputCls} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="lastName">Last name</label>
          <input id="lastName" className={inputCls} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="phone">Phone <span className="font-normal text-muted">(optional)</span></label>
          <input id="phone" type="tel" className={inputCls} placeholder="+972 5x xxx xxxx" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="language">Language</label>
          <select id="language" className={selectCls} value={form.language} onChange={(e) => set('language', e.target.value)}>
            {UPDATE_PROFILE_LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-5">
        <label className={labelCls} htmlFor="email">Email</label>
        <input id="email" className={`${inputCls} cursor-not-allowed opacity-70`} value={me.user.email} readOnly disabled />
        <p className="mt-1.5 text-[12px] text-muted">Email changes need verification — coming in a later update.</p>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="rounded-full bg-brand px-5 py-2.5 text-[14px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span className="text-[13px] font-medium" style={{ color: 'var(--brand)' }}>Saved</span>}
      </div>
    </section>
  );
}

function PasswordCard() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) => { setForm({ ...form, [k]: v }); setDone(false); };

  async function change() {
    setError('');
    if (form.newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
    setBusy(true);
    try {
      await api.changePassword(form);
      setForm({ currentPassword: '', newPassword: '' });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'INVALID_PASSWORD'
          ? 'Your current password is incorrect.'
          : err instanceof ApiError ? err.message : 'Could not change your password.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-[16px] font-semibold">Password</h2>
      {error && <p className="mb-4 rounded-xl border border-[color:var(--accent)] bg-field px-4 py-3 text-[13.5px]" role="alert">{error}</p>}

      <div className="mb-4">
        <label className={labelCls} htmlFor="current">Current password</label>
        <input id="current" type="password" className={inputCls} value={form.currentPassword} onChange={(e) => set('currentPassword', e.target.value)} autoComplete="current-password" />
      </div>
      <div className="mb-5">
        <label className={labelCls} htmlFor="new">New password</label>
        <input id="new" type="password" className={inputCls} value={form.newPassword} onChange={(e) => set('newPassword', e.target.value)} autoComplete="new-password" />
        <p className="mt-1.5 text-[12px] text-muted">At least 8 characters.</p>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={change} disabled={busy || !form.currentPassword || !form.newPassword}
          className="rounded-full bg-brand px-5 py-2.5 text-[14px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">
          {busy ? 'Updating…' : 'Update password'}
        </button>
        {done && <span className="text-[13px] font-medium" style={{ color: 'var(--brand)' }}>Password updated</span>}
      </div>
    </section>
  );
}
