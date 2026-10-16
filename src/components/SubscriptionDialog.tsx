'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  deleteSubscription, saveSubscription, setSubscriptionStatus,
  type SubscriptionRow,
} from '@/app/actions/subscriptions';
import type { SubscriptionCycle, SubscriptionStatus } from '@/lib/subscriptionSchedule';
import { cn, parseAmountInput } from '@/lib/utils';

// Radix refuses an empty string as a SelectItem value, so "none" needs a name.
const NONE = '__none__';

const CYCLE_OPTIONS: { value: SubscriptionCycle; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const STATUS_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended', label: 'Ended' },
];

interface Props {
  /** Absent means this dialog adds a new subscription. */
  subscription?: SubscriptionRow;
  /** The user's today, for the first-payment default. */
  today: string;
  categories: string[];
  accounts: { id: string; name: string; archived: boolean }[];
  children: ReactNode;
}

export function SubscriptionDialog({ subscription, today, categories, accounts, children }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [more, setMore] = useState(false);

  const [name, setName] = useState(subscription?.name ?? '');
  const [amount, setAmount] = useState(subscription ? subscription.amount.toFixed(2) : '');
  const [cycle, setCycle] = useState<SubscriptionCycle>(subscription?.cycle ?? 'monthly');
  const [anchorDate, setAnchorDate] = useState(subscription?.anchorDate ?? today);
  const [emoji, setEmoji] = useState(subscription?.emoji ?? '');
  const [category, setCategory] = useState(subscription?.category ?? NONE);
  const [accountId, setAccountId] = useState(subscription?.paymentMethodId ?? NONE);
  const [website, setWebsite] = useState(subscription?.website ?? '');
  const [notes, setNotes] = useState(subscription?.notes ?? '');

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // The content unmounts on close but this state lives out here, so without
      // a re-seed a reopened form shows the last cancelled draft — or, after an
      // add, the subscription just added, one click from being saved twice.
      setName(subscription?.name ?? '');
      setAmount(subscription ? subscription.amount.toFixed(2) : '');
      setCycle(subscription?.cycle ?? 'monthly');
      setAnchorDate(subscription?.anchorDate ?? today);
      setEmoji(subscription?.emoji ?? '');
      setCategory(subscription?.category ?? NONE);
      setAccountId(subscription?.paymentMethodId ?? NONE);
      setWebsite(subscription?.website ?? '');
      setNotes(subscription?.notes ?? '');
    } else {
      setConfirmingDelete(false);
      setMore(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const res = await saveSubscription({
      id: subscription?.id,
      name,
      amount: parseAmountInput(amount),
      cycle,
      anchorDate,
      emoji,
      category: category === NONE ? null : category,
      paymentMethodId: accountId === NONE ? null : accountId,
      website,
      notes,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(subscription ? 'Saved' : 'Added');
    handleOpenChange(false);
    router.refresh();
  }

  async function handleStatus(next: SubscriptionStatus) {
    if (!subscription || next === subscription.status) return;
    setSaving(true);
    const res = await setSubscriptionStatus(subscription.id, next);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error || 'Could not change status');
      return;
    }
    handleOpenChange(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!subscription) return;
    setSaving(true);
    const res = await deleteSubscription(subscription.id);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error || 'Could not delete');
      return;
    }
    toast.success('Deleted');
    handleOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {/* Same shell as MonthPicker: centred on desktop, bottom sheet on a phone. */}
      <DialogContent
        className="
          border-0 p-6 gap-4 bg-paper-card max-h-[85vh] overflow-y-auto
          max-lg:rounded-t-3xl max-lg:rounded-b-none max-lg:max-w-none max-lg:w-full
          max-lg:pb-[calc(1.5rem+env(safe-area-inset-bottom))]
          max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto
          max-lg:translate-x-0 max-lg:translate-y-0
          lg:rounded-3xl lg:max-w-md
        "
      >
        {/* pr-6: the close button sits over the title's right edge, and a name
            long enough to wrap would otherwise run its first line under it. */}
        <DialogTitle className="pr-6 text-base font-bold tracking-tight">
          {subscription ? subscription.name : 'New subscription'}
        </DialogTitle>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="sub-name">Name</Label>
            <Input id="sub-name" value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="Spotify" autoComplete="off" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sub-amount">Amount</Label>
              <Input id="sub-amount" value={amount} onChange={(e) => setAmount(e.target.value)}
                     inputMode="decimal" placeholder="11.99" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sub-cycle">Billing cycle</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as SubscriptionCycle)}>
                <SelectTrigger id="sub-cycle" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CYCLE_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sub-date">First payment date</Label>
            {/* Native date input — already correct on every platform, and it
                hands back exactly the "YYYY-MM-DD" the column wants. */}
            <Input id="sub-date" type="date" value={anchorDate}
                   onChange={(e) => setAnchorDate(e.target.value)} />
            <p className="text-[11px] text-ink-faint">
              {subscription
                ? 'This is the billing anchor. Changing it re-dates the whole series, past payments included.'
                : 'Every later payment is counted from here. A 31st falls back to the 28th in February and returns to the 31st in March.'}
            </p>
          </div>

          <button type="button" onClick={() => setMore((m) => !m)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink transition-colors">
            <ChevronDown className={cn('h-3 w-3 transition-transform', more && 'rotate-180')} />
            {more ? 'Less' : 'More'}
          </button>

          {more && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="sub-emoji">Emoji</Label>
                  {/* No maxLength: it counts UTF-16 units, and 🏋️‍♀️ is six of
                      them, so the cap would cut the sequence mid-joiner and
                      leave a mojibake fragment. The action validates by
                      grapheme instead. */}
                  <Input id="sub-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)}
                         placeholder="🎵" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sub-category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="sub-category" className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="sub-account">Pays from</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="sub-account" className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.archived ? `${a.name} (archived)` : a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="sub-website">Website</Label>
                <Input id="sub-website" value={website} onChange={(e) => setWebsite(e.target.value)}
                       placeholder="spotify.com" autoComplete="off" />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="sub-notes">Notes</Label>
                <Textarea id="sub-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
          )}
        </div>

        {subscription && (
          <div className="flex items-center gap-3 pt-1">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                disabled={saving}
                onClick={() => handleStatus(s.value)}
                className={cn(
                  'text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40',
                  subscription.status === s.value ? 'text-ink' : 'text-ink-faint hover:text-ink-soft',
                )}
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              disabled={saving}
              onClick={() => (confirmingDelete ? handleDelete() : setConfirmingDelete(true))}
              className="ml-auto text-[10px] font-bold uppercase tracking-widest text-accent hover:opacity-80 disabled:opacity-40"
            >
              {confirmingDelete ? 'Really delete?' : 'Delete'}
            </button>
          </div>
        )}

        {confirmingDelete && (
          <p className="text-[11px] text-ink-faint">
            The payments already recorded stay in History. Only the schedule goes.
          </p>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {subscription ? 'Save' : 'Add subscription'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
