import type { ReactNode } from 'react';
import Link from 'next/link';
import { LogoMark } from './logo';

/** Simple centered content page (Terms, Privacy, Forgot password, …). */
export function InfoPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="flex h-[60px] items-center justify-between border-b border-line bg-surface px-6">
        <Link href="/login" className="flex items-center gap-2.5 text-[17px] font-bold">
          <LogoMark size={26} /> Dokane
        </Link>
        <Link href="/login" className="text-[13px] text-muted hover:text-ink">← Back to sign in</Link>
      </header>
      <div className="mx-auto max-w-[720px] px-6 py-10">
        <h1 className="font-display text-[28px] font-medium tracking-tight">{title}</h1>
        <div className="mt-4 space-y-3 text-[14.5px] leading-[1.65] text-muted">{children}</div>
      </div>
    </div>
  );
}
