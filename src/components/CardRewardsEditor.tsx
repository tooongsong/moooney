'use client';

import { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateCardSettings } from '@/app/actions/accounts';
import type { CardRewards } from '@/lib/bestCard';

interface Row { category: string; rate: string }

const onlyRate = (v: string) => v.replace(/[^0-9.]/g, '');
const FIELD = 'rounded-lg border-line bg-paper-card text-sm h-9 tabular-nums';
const LABEL = 'text-[10px] font-semibold uppercase tracking-widest text-ink-soft';

export function CardRewardsEditor({
  accountId, initial, initialDueDay, categories,
}: { accountId: string; initial: CardRewards | null; initialDueDay: number | null; categories: string[] }) {
  const [dueDay, setDueDay] = useState(initialDueDay ? String(initialDueDay) : '');
  const [base, setBase] = useState(initial ? String(initial.base) : '');
  const [rows, setRows] = useState<Row[]>(
    () => Object.entries(initial?.categories ?? {}).map(([category, rate]) => ({ category, rate: String(rate) })),
  );
  const [newCategory, setNewCategory] = useState('');
  const [newRate, setNewRate] = useState('');
  const [saving, setSaving] = useState(false);

  const unused = categories.filter((c) => !rows.some((r) => r.category === c));

  function addRow() {
    if (!newCategory || !newRate) return;
    setRows((prev) => [...prev, { category: newCategory, rate: newRate }]);
    setNewCategory('');
    setNewRate('');
  }

  async function save() {
    setSaving(true);
    const result = await updateCardSettings(accountId, {
      base: base === '' ? 0 : Number(base),
      categories: Object.fromEntries(rows.map((r) => [r.category, Number(r.rate)])),
      dueDay: dueDay === '' ? null : Number(dueDay),
    });
    setSaving(false);
    if (result.success) toast.success('Saved');
    else toast.error(result.error);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="card-due-day" className={LABEL}>Payment due · day of month</label>
        <Input id="card-due-day" inputMode="numeric" value={dueDay} placeholder="—"
          onChange={(e) => setDueDay(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
          className={`${FIELD} w-20 text-right`} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <label htmlFor="rewards-base" className={LABEL}>Base · everything else</label>
        <span className="flex items-center gap-1.5">
          <Input id="rewards-base" inputMode="decimal" value={base} placeholder="0"
            onChange={(e) => setBase(onlyRate(e.target.value))} className={`${FIELD} w-20 text-right`} />
          <span className="text-sm text-ink-soft">%</span>
        </span>
      </div>

      {rows.map((row, i) => (
        <div key={row.category} className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-semibold text-ink">
            {row.category}
            {!categories.includes(row.category) && (
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-ink-soft">Unused</span>
            )}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <Input inputMode="decimal" value={row.rate} aria-label={`${row.category} rate`}
              onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, rate: onlyRate(e.target.value) } : r)))}
              className={`${FIELD} w-20 text-right`} />
            <span className="text-sm text-ink-soft">%</span>
            <button type="button" aria-label={`Remove ${row.category}`}
              onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              className="w-9 h-9 rounded-full flex items-center justify-center text-ink-soft hover:bg-sand transition-colors">
              <X className="h-4 w-4" />
            </button>
          </span>
        </div>
      ))}

      {unused.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <Select value={newCategory} onValueChange={setNewCategory}>
            <SelectTrigger className="rounded-lg border-line bg-paper-card h-9 text-sm flex-1 min-w-0" aria-label="Category">
              <SelectValue placeholder="Add category" />
            </SelectTrigger>
            <SelectContent>
              {unused.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input inputMode="decimal" value={newRate} placeholder="0" aria-label="New category rate"
            onChange={(e) => setNewRate(onlyRate(e.target.value))} className={`${FIELD} w-20 text-right`} />
          <span className="text-sm text-ink-soft">%</span>
          <button type="button" aria-label="Add category rate" onClick={addRow} disabled={!newCategory || !newRate}
            className="w-9 h-9 shrink-0 rounded-full bg-ink text-paper flex items-center justify-center disabled:opacity-30">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      <button type="button" onClick={save} disabled={saving}
        className="w-full h-12 rounded-full bg-accent text-white text-sm font-semibold uppercase tracking-widest flex items-center justify-center disabled:opacity-50">
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save'}
      </button>
    </div>
  );
}
