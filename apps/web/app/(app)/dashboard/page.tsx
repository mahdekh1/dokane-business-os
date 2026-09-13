const tiles = [
  { label: 'Today’s sales', value: '$2,480', note: '+12% vs yesterday', tone: 'up' },
  { label: 'Orders today', value: '18', note: '4 awaiting fulfilment' },
  { label: 'Low stock', value: '5', note: 'items below threshold', tone: 'warn' },
  { label: 'Outstanding', value: '$1,150', note: '3 unpaid orders' },
];

const orders = [
  { n: '#1042', cust: 'Lina K.', chan: 'Online', amt: '$96.00', pill: 'Paid' },
  { n: '#1041', cust: 'Walk-in', chan: 'In-store', amt: '$34.50', pill: 'Paid' },
  { n: '#1040', cust: 'Omar B.', chan: 'Online', amt: '$212.00', pill: 'Unpaid' },
  { n: '#1039', cust: 'Sara M.', chan: 'In-store', amt: '$58.00', pill: 'Paid' },
];

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Overview</h1>
          <p className="mt-1 text-[13.5px] text-muted">Today at a glance across your channels.</p>
        </div>
        <span className="rounded-full border border-dashed border-line px-2.5 py-1 text-[11px] uppercase tracking-[.1em] text-muted">
          Sample data
        </span>
      </div>

      <div className="mb-[18px] grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-[18px]">
            <span className="text-[13px] text-muted">{t.label}</span>
            <b className="text-[26px] font-bold tracking-tight">{t.value}</b>
            <span className="text-[12px]" style={{ color: t.tone === 'up' ? 'var(--brand)' : t.tone === 'warn' ? 'var(--accent)' : 'var(--muted)' }}>
              {t.note}
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-line bg-surface p-[18px]">
          <div className="mb-2 flex items-center justify-between">
            <b className="text-[15px] font-semibold">Recent orders</b>
            <a href="/orders" className="text-[13px] font-medium text-brand hover:underline">View all</a>
          </div>
          <div>
            {orders.map((o, i) => (
              <div key={o.n} className="grid grid-cols-[52px_1fr_auto_auto_auto] items-center gap-2.5 py-[11px] text-[13.5px]"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <span className="tabular-nums text-muted">{o.n}</span>
                <span className="font-medium">{o.cust}</span>
                <span className="rounded-full px-2 py-[3px] text-[11px]"
                  style={o.chan === 'Online'
                    ? { background: 'rgba(14,106,87,.12)', color: '#0E6A57' }
                    : { background: 'rgba(217,142,75,.16)', color: '#95571b' }}>
                  {o.chan}
                </span>
                <span className="tabular-nums font-semibold">{o.amt}</span>
                <span className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold"
                  style={o.pill === 'Paid'
                    ? { background: 'rgba(14,106,87,.12)', color: '#0E6A57' }
                    : { background: 'rgba(180,116,28,.16)', color: '#95571b' }}>
                  {o.pill}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-[18px]">
          <div className="mb-2 flex items-center justify-between">
            <b className="text-[15px] font-semibold">Sales by channel</b>
            <span className="text-[12px] text-muted">today</span>
          </div>
          <Bar label="In-store" amount="$1,520" pct={61} color="var(--brand)" />
          <Bar label="Online store" amount="$960" pct={39} color="var(--accent)" />
          <div className="mt-4 border-t border-line pt-3.5 text-[13px] text-muted">
            Global total <b className="text-ink">$2,480</b> across 2 channels
          </div>
        </section>
      </div>
    </div>
  );
}

function Bar({ label, amount, pct, color }: { label: string; amount: string; pct: number; color: string }) {
  return (
    <div className="my-3.5">
      <div className="mb-1.5 flex justify-between text-[13px]">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{amount}</span>
      </div>
      <div className="h-[9px] rounded-full" style={{ background: 'rgba(14,106,87,.10)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
