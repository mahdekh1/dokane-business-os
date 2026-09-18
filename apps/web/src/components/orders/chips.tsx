import { fulfillmentStatusLabel, paymentStatusLabel } from '@dokane/contracts';

type Tone = 'good' | 'warn' | 'danger' | 'info' | 'muted';
const TONE: Record<Tone, { background: string; color: string }> = {
  good: { background: 'rgba(18,144,122,.16)', color: '#5fd3b6' },
  warn: { background: 'rgba(224,167,94,.16)', color: '#e6ad74' },
  danger: { background: 'rgba(224,139,122,.16)', color: '#e08b7a' },
  info: { background: 'rgba(120,150,210,.18)', color: '#a9c0ef' },
  muted: { background: 'var(--field)', color: 'var(--muted)' },
};

function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={TONE[tone]}>
      {children}
    </span>
  );
}

const FULFILLMENT_TONE: Record<string, Tone> = {
  DRAFT: 'muted', PENDING: 'warn', CONFIRMED: 'info', PROCESSING: 'info',
  READY: 'info', SHIPPED: 'info', COMPLETED: 'good', CANCELLED: 'muted',
};
const PAYMENT_TONE: Record<string, Tone> = {
  UNPAID: 'danger', PARTIALLY_PAID: 'warn', PAID: 'good', REFUNDED: 'muted', PARTIALLY_REFUNDED: 'muted',
};

export const FulfillmentChip = ({ status }: { status: string }) => (
  <Chip tone={FULFILLMENT_TONE[status] ?? 'muted'}>{fulfillmentStatusLabel(status)}</Chip>
);
export const PaymentChip = ({ status }: { status: string }) => (
  <Chip tone={PAYMENT_TONE[status] ?? 'muted'}>{paymentStatusLabel(status)}</Chip>
);
