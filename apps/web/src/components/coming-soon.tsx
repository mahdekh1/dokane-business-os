export function ComingSoon({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <div className="max-w-[820px]">
      <h1 className="text-[24px] font-bold tracking-tight">{title}</h1>
      {blurb && <p className="mt-1 text-[13.5px] text-muted">{blurb}</p>}
      <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-field text-[18px]">🚧</div>
        <h2 className="text-[16px] font-semibold">Coming soon</h2>
        <p className="mx-auto mt-1.5 max-w-[46ch] text-[13.5px] text-muted">
          This platform-admin area is on the roadmap. The navigation is ready; its
          screens will appear here in an upcoming phase.
        </p>
      </div>
    </div>
  );
}
