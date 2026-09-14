import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  width: 19,
  height: 19,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

export const Icon = {
  dashboard: (p: P) => (
    <svg {...base(p)}>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  ),
  store: (p: P) => (
    <svg {...base(p)}>
      <path d="M5 8h14l-1 11H6L5 8zM9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  calendar: (p: P) => (
    <svg {...base(p)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  ),
  catalog: (p: P) => (
    <svg {...base(p)}>
      <path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7" />
    </svg>
  ),
  inventory: (p: P) => (
    <svg {...base(p)}>
      <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" />
    </svg>
  ),
  crm: (p: P) => (
    <svg {...base(p)}>
      <path d="M16 20v-1a4 4 0 0 0-8 0v1" />
      <circle cx="12" cy="9" r="3.4" />
    </svg>
  ),
  accounting: (p: P) => (
    <svg {...base(p)}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />
    </svg>
  ),
  projects: (p: P) => (
    <svg {...base(p)}>
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  ),
  team: (p: P) => (
    <svg {...base(p)}>
      <path d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
      <circle cx="10" cy="8" r="3.2" />
      <path d="M17 4a3.2 3.2 0 0 1 0 6.3" />
    </svg>
  ),
  settings: (p: P) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </svg>
  ),
  approvals: (p: P) => (
    <svg {...base(p)}>
      <path d="M9 12l2 2 4-4M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7z" />
    </svg>
  ),
  audit: (p: P) => (
    <svg {...base(p)}>
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  ),
  bell: (p: P) => (
    <svg {...base(p)}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  plus: (p: P) => (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  globe: (p: P) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
    </svg>
  ),
  chevronDown: (p: P) => (
    <svg {...base(p)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  lock: (p: P) => (
    <svg {...base(p)}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  ),
  logout: (p: P) => (
    <svg {...base(p)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
  ai: (p: P) => (
    <svg {...base(p)}>
      <path d="M12 3l2.1 4.9L19 10l-4.9 2.1L12 17l-2.1-4.9L5 10l4.9-2.1z" />
    </svg>
  ),
} as const;

export type IconName = keyof typeof Icon;
