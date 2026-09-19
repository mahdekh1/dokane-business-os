'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { variantKey, type CategoryDto, type OfferingDto, type OfferingKind } from '@dokane/contracts';
import { api, ApiError, mediaUrl } from '../../lib/api';
import { inputCls, labelCls } from '../../lib/ui';

const selectCls = 'w-full h-[44px] rounded-[11px] bg-field border border-transparent px-3 text-[14.5px] text-ink outline-none focus:border-brand';
const toMinor = (v: string): number => Math.round((parseFloat(v) || 0) * 100);
const toMajor = (n: number): string => (n / 100).toFixed(2);

interface Attr { name: string; values: string[] }
interface VariantRow { price: string; sku: string }

function cartesian(attrs: Attr[]): Record<string, string>[] {
  const usable = attrs.filter((a) => a.name.trim() && a.values.length > 0);
  if (usable.length === 0) return [];
  return usable.reduce<Record<string, string>[]>(
    (acc, a) => acc.flatMap((combo) => a.values.map((val) => ({ ...combo, [a.name.trim()]: val }))),
    [{}],
  );
}

export function OfferingForm({ id }: { id?: string }) {
  const router = useRouter();
  const editing = Boolean(id);
  const [ready, setReady] = useState(!editing);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<OfferingKind>('physical');
  const [trackInventory, setTrackInventory] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');

  const [hasVariants, setHasVariants] = useState(false);
  const [attrs, setAttrs] = useState<Attr[]>([{ name: 'Size', values: [] }]);
  const [rows, setRows] = useState<Record<string, VariantRow>>({});

  const [existingMedia, setExistingMedia] = useState<OfferingDto['media']>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  useEffect(() => {
    void api.catalog.categories.list().then(setCategories).catch(() => undefined);
    if (!id) return;
    void api.catalog.get(id).then((o) => {
      setName(o.name);
      setType(o.type);
      setTrackInventory(o.trackInventory);
      setCategoryId(o.categoryId ?? '');
      setPrice(toMajor(o.price));
      setSku(o.sku ?? '');
      setBarcode(o.barcode ?? '');
      setDescription(o.description ?? '');
      setExistingMedia(o.media);
      if (o.variants.length > 0) {
        setHasVariants(true);
        const names = Array.from(new Set(o.variants.flatMap((v) => Object.keys(v.attributes))));
        setAttrs(names.map((n) => ({ name: n, values: Array.from(new Set(o.variants.map((v) => v.attributes[n]).filter(Boolean) as string[])) })));
        const map: Record<string, VariantRow> = {};
        for (const v of o.variants) map[v.key] = { price: toMajor(v.price), sku: v.sku ?? '' };
        setRows(map);
      }
      setReady(true);
    }).catch(() => { setError('Could not load this product.'); setReady(true); });
  }, [id]);

  const combos = useMemo(() => cartesian(attrs), [attrs]);

  // Ensure every current combo has a row (keyed by canonical key), preserving edits.
  useEffect(() => {
    if (!hasVariants) return;
    setRows((prev) => {
      const next: Record<string, VariantRow> = {};
      for (const c of combos) {
        const k = variantKey(c);
        next[k] = prev[k] ?? { price: price || '', sku: '' };
      }
      return next;
    });
  }, [combos, hasVariants, price]);

  if (!ready) return <p className="text-[14px] text-muted">Loading…</p>;

  const setAttr = (i: number, patch: Partial<Attr>) => setAttrs((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addValue = (i: number, val: string) => {
    const v = val.trim();
    if (v && !attrs[i]!.values.includes(v)) setAttr(i, { values: [...attrs[i]!.values, v] });
  };

  async function submit() {
    setError('');
    if (!name.trim()) { setError('Give the product a name.'); return; }
    setBusy(true);
    try {
      const variants = hasVariants
        ? combos.map((c) => {
            const r = rows[variantKey(c)] ?? { price: price, sku: '' };
            return { attributes: c, price: toMinor(r.price || price), sku: r.sku || undefined, active: true };
          })
        : [];
      const payload = {
        type,
        name: name.trim(),
        description: description || undefined,
        categoryId: categoryId || null,
        sku: !hasVariants && sku ? sku : undefined,
        barcode: !hasVariants && barcode ? barcode : undefined,
        price: toMinor(price),
        trackInventory: type === 'physical' ? trackInventory : false,
        active: true,
        variants,
      };
      const saved = id ? await api.catalog.update(id, payload) : await api.catalog.create(payload);
      for (const f of newFiles) await api.catalog.uploadMedia(saved.id, f);
      router.push('/catalog');
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'SKU_TAKEN' ? 'That SKU is already used.'
          : err instanceof ApiError && err.code === 'BARCODE_TAKEN' ? 'That barcode is already used.'
          : err instanceof ApiError ? err.message : 'Could not save the product.',
      );
      setBusy(false);
    }
  }

  async function addCategory() {
    const label = window.prompt('New category name');
    if (!label) return;
    try {
      const c = await api.catalog.categories.create({ name: label, active: true });
      setCategories((cs) => [...cs, c]);
      setCategoryId(c.id);
    } catch { /* ignore */ }
  }

  return (
    <div className="max-w-[720px]">
      <p className="mb-2 text-[12.5px] text-muted">Catalog / <span className="font-medium text-ink">{editing ? 'Edit product' : 'New product'}</span></p>
      <h1 className="font-display text-[27px] font-medium tracking-tight">{editing ? 'Edit product' : 'New product'}</h1>
      <p className="mb-6 mt-1 text-[13.5px] text-muted">Physical &amp; digital goods. Services &amp; courses are their own modules.</p>

      {error && <p className="mb-4 rounded-xl border border-[color:var(--accent)] bg-field px-4 py-3 text-[13.5px]" role="alert">{error}</p>}

      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-4">
          <label className={labelCls}>Product name</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cotton T-Shirt" />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Type</label>
            <div className="inline-flex rounded-[11px] bg-field p-[3px]">
              {(['physical', 'digital'] as const).map((t) => (
                <button key={t} type="button" onClick={() => { setType(t); setTrackInventory(t === 'physical'); }}
                  className="rounded-[9px] px-4 py-2 text-[13.5px] font-semibold capitalize"
                  style={type === t ? { background: 'var(--brand)', color: 'var(--on-brand)' } : { color: 'var(--muted)' }}>
                  {t === 'physical' ? 'Physical' : 'Digital'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <div className="flex gap-2">
              <select className={selectCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" onClick={addCategory} className="h-[44px] flex-none rounded-[11px] border border-line px-3 text-[13px] text-ink hover:border-line-strong">+ New</button>
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{hasVariants ? 'Base price' : 'Price'}</label>
            <div className="flex h-[44px] items-center rounded-[11px] border border-transparent bg-field px-3 focus-within:border-brand">
              <span className="mr-1.5 text-muted">₪</span>
              <input className="w-full bg-transparent text-[14.5px] text-ink outline-none" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          {!hasVariants && (
            <div>
              <label className={labelCls}>SKU <span className="font-normal text-muted">(optional)</span></label>
              <input className={inputCls} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. TSHIRT-001" />
            </div>
          )}
        </div>

        {type === 'physical' && (
          <div className="mb-4">
            <button type="button" onClick={() => setTrackInventory((v) => !v)} className="flex items-center gap-2.5">
              <span className="relative h-[23px] w-[40px] flex-none rounded-full transition-colors" style={{ background: trackInventory ? 'var(--brand)' : 'var(--field)' }}>
                <span className="absolute top-[2.5px] h-[18px] w-[18px] rounded-full transition-all" style={{ left: trackInventory ? '19px' : '2.5px', background: trackInventory ? '#fff' : '#8b978f' }} />
              </span>
              <b className="text-[14px]">Track stock</b>
              <span className="text-[12.5px] font-normal text-muted">— {trackInventory ? 'sales reduce inventory and can’t oversell' : 'sell freely; no stock is counted'}</span>
            </button>
          </div>
        )}

        <div className="mb-4">
          <label className={labelCls}>Description</label>
          <textarea className={`${inputCls} min-h-[72px] py-2.5`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the product…" />
        </div>

        <div className="mb-1">
          <label className={labelCls}>Images</label>
          <div className="flex flex-wrap items-center gap-2">
            {existingMedia.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={mediaUrl(m.url)} alt={m.altText ?? ''} className="h-16 w-16 rounded-lg border border-line object-cover" />
            ))}
            {newFiles.map((f, i) => (
              <span key={i} className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-line-strong text-[10px] text-muted">{f.name.slice(0, 8)}…</span>
            ))}
            <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-lg border border-dashed border-line-strong text-[22px] text-muted hover:border-brand hover:text-brand">
              +
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setNewFiles((fs) => [...fs, ...Array.from(e.target.files ?? [])])} />
            </label>
          </div>
          <p className="mt-1.5 text-[12px] text-muted">JPEG / PNG / WEBP, up to 5 MB each.</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
        <button type="button" onClick={() => setHasVariants((v) => !v)} className="flex items-center gap-2.5">
          <span className="relative h-[23px] w-[40px] flex-none rounded-full transition-colors" style={{ background: hasVariants ? 'var(--brand)' : 'var(--field)' }}>
            <span className="absolute top-[2.5px] h-[18px] w-[18px] rounded-full transition-all" style={{ left: hasVariants ? '19px' : '2.5px', background: hasVariants ? '#fff' : '#8b978f' }} />
          </span>
          <b className="text-[14px]">This product has variants</b>
          <span className="text-[12.5px] font-normal text-muted">— size, colour, etc.</span>
        </button>

        {hasVariants && (
          <div className="mt-4">
            {attrs.map((a, i) => (
              <div key={i} className="mb-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <input className="h-8 w-[140px] rounded-lg bg-field px-2.5 text-[13px] text-ink outline-none" value={a.name} onChange={(e) => setAttr(i, { name: e.target.value })} placeholder="Attribute" />
                  {attrs.length > 1 && <button type="button" onClick={() => setAttrs((x) => x.filter((_, j) => j !== i))} className="text-[12px] text-muted hover:text-ink">Remove</button>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {a.values.map((v, vi) => (
                    <span key={vi} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-[color:var(--field)] px-2.5 py-1 text-[12.5px]">
                      {v}<span className="cursor-pointer text-muted" onClick={() => setAttr(i, { values: a.values.filter((_, j) => j !== vi) })}>✕</span>
                    </span>
                  ))}
                  <input className="h-[29px] w-[110px] rounded-full border border-dashed border-line-strong bg-field px-2.5 text-[12.5px] text-ink outline-none"
                    placeholder="+ add value" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addValue(i, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }} />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setAttrs((x) => [...x, { name: '', values: [] }])} className="mb-3 text-[12.5px] font-semibold text-brand">+ Add attribute</button>

            {combos.length > 0 && (
              <>
                <div className="mb-2 mt-1 flex items-center justify-between">
                  <b className="text-[14px]">Variants</b><span className="text-[12px] text-muted">{combos.length} combinations</span>
                </div>
                <table className="w-full border-collapse">
                  <thead><tr className="text-[11px] uppercase tracking-[.05em] text-muted"><th className="pb-1.5 text-left font-semibold">Variant</th><th className="pb-1.5 text-left font-semibold">Price</th><th className="pb-1.5 text-left font-semibold">SKU</th></tr></thead>
                  <tbody>
                    {combos.map((c) => {
                      const k = variantKey(c);
                      const r = rows[k] ?? { price: '', sku: '' };
                      return (
                        <tr key={k}>
                          <td className="border-t border-line py-2 pr-2 text-[13px] font-medium">{Object.values(c).join(' / ')}</td>
                          <td className="border-t border-line py-2 pr-2">
                            <div className="flex h-9 w-[110px] items-center rounded-lg border border-transparent bg-field px-2.5 focus-within:border-brand">
                              <span className="mr-1 text-[12px] text-muted">₪</span>
                              <input className="w-full bg-transparent text-[13px] text-ink outline-none" inputMode="decimal" value={r.price}
                                onChange={(e) => setRows((p) => ({ ...p, [k]: { ...r, price: e.target.value } }))} />
                            </div>
                          </td>
                          <td className="border-t border-line py-2">
                            <input className="h-9 w-[140px] rounded-lg bg-field px-2.5 text-[13px] text-ink outline-none" placeholder="SKU" value={r.sku}
                              onChange={(e) => setRows((p) => ({ ...p, [k]: { ...r, sku: e.target.value } }))} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-[12px] text-muted">Stock per variant is set in <b className="text-ink">Inventory</b>. Editing an option keeps existing rows.</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2.5">
        <button type="button" onClick={() => router.push('/catalog')} className="rounded-full border border-line px-5 py-2.5 text-[13.5px] font-semibold text-ink">Cancel</button>
        <button type="button" onClick={submit} disabled={busy} className="rounded-full bg-brand px-5 py-2.5 text-[13.5px] font-bold text-on-brand hover:bg-brand-2 disabled:opacity-60">
          {busy ? 'Saving…' : 'Save product'}
        </button>
      </div>
    </div>
  );
}
