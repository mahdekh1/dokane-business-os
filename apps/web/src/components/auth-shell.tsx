'use client';

import type { ReactNode } from 'react';
import { Icon } from './icons';
import { LogoMark } from './logo';

function LangSwitch() {
  return (
    <button
      type="button"
      aria-label="Change language"
      className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-[7px] text-[13px] text-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      <Icon.globe width={15} height={15} />
      English
      <Icon.chevronDown width={11} height={11} />
    </button>
  );
}

export function AuthShell({ panel, children }: { panel: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh md:grid-cols-[1.1fr_1fr]">
      <section
        className="relative hidden overflow-hidden px-12 py-11 md:flex md:flex-col"
        style={{ background: 'linear-gradient(150deg,#0E6A57,#0A4A3D)', color: 'var(--on-brand)' }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,.16) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative z-10 flex items-center gap-2.5 text-[20px] font-bold">
          <LogoMark tone="var(--on-brand)" />
          Dokane
        </div>
        <div className="relative z-10 mt-auto">{panel}</div>
      </section>

      <section className="flex flex-col px-6 py-7 md:px-10">
        <div className="flex justify-end">
          <LangSwitch />
        </div>
        <div className="m-auto w-full max-w-[400px] py-4">{children}</div>
      </section>
    </div>
  );
}
