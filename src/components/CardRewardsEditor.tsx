'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateCardSettings } from '@/app/actions/accounts';
import type { CardRewards } from '@/lib/bestCard';

interface Row { category: string; rate: string }

const onlyRate = (v: string) => v.replace(/[^0-9.]/g, '');
const ROW = 'flex items-center gap-2';
// Every field is the same width and sits flush with the right edge.
const BOX = 'relative w-24 shrink-0';
const FIELD = 'text-right tabular-nums';
const UNIT = 'pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-soft';
const LABEL = 'flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-widest text-ink-soft';

export function CardRewardsEditor({
  accountId, initial, initialDueDay, categories,
}: { accountId: string; initial: CardRewards | null; initialDueDay: number | null; categories: string[] }) {
  const [dueDay, setDueDay] = useState(initialDueDay ? String(initialDueDay) : '');
  const [base, setBase] = useState(initial ? String(initial.base) : '');
  const [rows, setRows] = useState<Row[]>(
    () => Object.entries(initial?.categories ?? {}).map(([category, rate]) => ({ category, rate: String(rate) })),
  );
  const [saving, setSaving] = useState(false);

  const unused = categories.filter((c) => !rows.some((r) => r.category === c));

  async function save() {
    setSaving(true);
    const result = await updateCardSettings(accountId, {
      base: base === '' ? 0 : Number(base),
      categories: Object.fromEntries(rows.filter((r) => r.rate !== '').map((r) => [r.category, Number(r.rate)])),
      dueDay: dueDay === '' ? null : Number(dueDay),
    });
    setSaving(false);
    if (result.success) toast.success('Saved');
    else toast.error(result.error);
  }

  return (
    <div className="space-y-3">
      <div className={ROW}>
        <label htmlFor="card-due-day" className={LABEL}>Payment due day</label>
        <div className={BOX}>
          <Input id="card-due-day" inputMode="numeric" value={dueDay} placeholder="—"
            onChange={(e) => setDueDay(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
            className={FIELD} />
        </div>
      </div>

      <div className={ROW}>
        <label htmlFor="rewards-base" className={LABEL}>Base · everything else</label>
        <div className={BOX}>
          <Input id="rewards-base" inputMode="decimal" value={base} placeholder="0"
            onChange={(e) => setBase(onlyRate(e.target.value))} className={`${FIELD} pr-9`} />
          <span className={UNIT}>%</span>
        </div>
      </div>

      {rows.map((row, i) => (
        <div key={row.category} className={ROW}>
          <span className="flex-1 min-w-0 truncate text-sm font-semibold text-ink">
            {row.category}
            {!categories.includes(row.category) && (
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-ink-soft">Unused</span>
            )}
          </span>
          <button type="button" aria-label={`Remove ${row.category}`}
            onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
            className="w-11 h-11 shrink-0 rounded-lg flex items-center justify-center text-ink-soft hover:bg-sand transition-colors">
            <X className="h-4 w-4" />
          </button>
          <div className={BOX}>
            <Input inputMode="decimal" value={row.rate} placeholder="0" aria-label={`${row.category} rate`}
              autoFocus={row.rate === ''}
              onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, rate: onlyRate(e.target.value) } : r)))}
              className={`${FIELD} pr-9`} />
            <span className={UNIT}>%</span>
          </div>
        </div>
      ))}

      {/* Picking a category adds its row straight away; a row left empty is not saved. */}
      {unused.length > 0 && (
        <Select value="" onValueChange={(c) => setRows((prev) => [...prev, { category: c, rate: '' }])}>
          <SelectTrigger aria-label="Add category">
            <SelectValue placeholder="Add category" />
          </SelectTrigger>
          <SelectContent>
            {unused.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <button type="button" onClick={save} disabled={saving}
        className="w-full h-12 rounded-lg bg-accent text-white text-sm font-semibold uppercase tracking-widest flex items-center justify-center disabled:opacity-50">
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save'}
      </button>
    </div>
  );
}
