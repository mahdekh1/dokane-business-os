export function LogoMark({ size = 30, tone = 'var(--brand)' }: { size?: number; tone?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="11"
        fill={tone === 'var(--brand)' ? 'rgba(14,106,87,.10)' : 'rgba(255,255,255,.10)'}
        stroke={tone}
        strokeWidth="1.6"
      />
      <path
        d="M12 27V13.5c0-.55.45-1 1-1h5.5c5 0 8 3 8 7.25S24.5 27 19.5 27H12Z"
        stroke={tone}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="19" cy="19.5" r="2.1" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark({ onBrand = false }: { onBrand?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark tone={onBrand ? 'var(--on-brand)' : 'var(--brand)'} />
      <span
        className="font-display text-[19px] font-semibold tracking-tight"
        style={{ color: onBrand ? 'var(--on-brand)' : 'var(--ink)' }}
      >
        Dokane
      </span>
    </span>
  );
}
