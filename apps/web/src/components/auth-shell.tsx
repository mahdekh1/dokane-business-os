'use client';

import type { ReactNode } from 'react';
import { LogoMark } from './logo';

export function AuthShell({ panel, children }: { panel: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh md:grid-cols-[1.1fr_1fr]">
      <section
        className="relative hidden overflow-hidden px-12 py-11 md:flex md:flex-col md:justify-center"
        style={{ background: 'linear-gradient(150deg,#0E6A57,#0A4A3D)', color: 'var(--on-brand)' }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,.16) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="absolute left-12 top-11 z-10 flex items-center gap-2.5 text-[20px] font-bold">
          <LogoMark tone="var(--on-brand)" />
          Dokane
        </div>
        <div className="relative z-10 max-w-[30rem]">{panel}</div>
      </section>

      <section className="flex flex-col px-6 py-7 md:px-10">
        <div className="m-auto w-full max-w-[400px] py-4">{children}</div>
      </section>
    </div>
  );
}
