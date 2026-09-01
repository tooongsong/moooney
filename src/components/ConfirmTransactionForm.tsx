'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, ChevronDown, Loader2, Plus, Settings2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TransactionType } from '@/lib/categories';
import { cn } from '@/lib/utils';
import type { SaveTransactionInput } from '@/app/actions/transactions';
import { addCustomCategory } from '@/app/actions/manage';

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'refund', label: 'Refund' },
];

const ADD_CATEGORY_VALUE = '__add_category__';

export interface ConfirmFormValues {
  amount: string;
  merchant: string;
  category: string;
  date: string;
  type: TransactionType;
  description: string;
  paymentMethod: string;
  notes: string;
  items?: { name: string; price: number | null }[] | null;
}

interface ConfirmTransactionFormProps {
  initial: ConfirmFormValues;
  categories: string[];
  paymentMethods?: string[];
  receiptImage?: string | null;
  needsReview?: boolean;
  saveLabel?: string;
  onSave: (input: SaveTransactionInput) => Promise<void>;
  onCancel?: () => void;
}

export function ConfirmTransactionForm({
  initial,
  categories,
  paymentMethods = [],
  receiptImage,
  needsReview,
  saveLabel = 'Save',
  onSave,
  onCancel,
}: ConfirmTransactionFormProps) {
  const [values, setValues] = useState<ConfirmFormValues>(initial);
  const [categoryList, setCategoryList] = useState(categories);
  const [showMore, setShowMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const amountNumber = parseFloat(values.amount);
  const canSave = !isNaN(amountNumber) && amountNumber > 0 && values.merchant.trim().length > 0 && !isSaving;

  function set<K extends keyof ConfirmFormValues>(key: K, value: ConfirmFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function confirmNewCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setIsSavingCategory(true);
    const result = await addCustomCategory(name);
    setIsSavingCategory(false);
    if (result.success) {
      setCategoryList((prev) => [...prev, name]);
      set('category', name);
      setIsAddingCategory(false);
      setNewCategory('');
    } else {
      toast.error(result.error || 'Could not add category');
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setIsSaving(true);
    try {
      await onSave({
        amount: amountNumber,
        merchant: values.merchant.trim(),
        category: values.category,
        date: values.date,
        type: values.type,
        description: values.description.trim() || values.merchant.trim(),
        paymentMethod: values.paymentMethod.trim() || null,
        notes: values.notes.trim() || null,
        items: values.items || null,
        receiptImage: receiptImage || null,
        needsReview: false,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {needsReview && (
        <div className="text-xs text-ink-soft border-l-4 border-accent pl-3 py-1">
          Some details weren&apos;t clear — please check them before saving.
        </div>
      )}

      {receiptImage && (
        <div className="relative w-full aspect-[4/3] bg-sand overflow-hidden">
          <Image src={receiptImage} alt="Receipt" fill className="object-contain" />
        </div>
      )}

      {/* Type toggle — underline tabs, not filled pills */}
      <div className="flex border-b border-line">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => set('type', opt.value)}
            className={cn(
              'flex-1 h-10 text-xs font-semibold uppercase tracking-widest transition-colors border-b-2 -mb-px',
              values.type === opt.value ? 'border-accent text-ink' : 'border-transparent text-ink-faint'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Amount — big and central */}
      <div className="text-center py-2">
        <div className="flex items-center justify-center gap-1">
          <span className="text-3xl text-ink-faint font-light">$</span>
          <input
            inputMode="decimal"
            value={values.amount}
            onChange={(e) => set('amount', e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            className="text-6xl font-bold text-ink tracking-tighter w-56 text-center bg-transparent outline-none placeholder:text-ink-faint"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="merchant" className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Merchant</Label>
          <Input
            id="merchant"
            value={values.merchant}
            onChange={(e) => set('merchant', e.target.value)}
            placeholder="e.g. Target"
            className="border-line bg-paper-card text-base"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Category</Label>
            {isAddingCategory ? (
              <div className="flex gap-1.5">
                <Input
                  autoFocus
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      confirmNewCategory();
                    }
                  }}
                  placeholder="New category"
                  className="border-line bg-paper-card h-9"
                />
                <button
                  type="button"
                  onClick={confirmNewCategory}
                  disabled={!newCategory.trim() || isSavingCategory}
                  className="w-9 h-9 shrink-0 bg-accent text-white flex items-center justify-center disabled:opacity-30"
                >
                  {isSavingCategory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCategory(false);
                    setNewCategory('');
                  }}
                  className="w-9 h-9 shrink-0 border border-line text-ink-soft flex items-center justify-center"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Select
                value={values.category}
                onValueChange={(v) => (v === ADD_CATEGORY_VALUE ? setIsAddingCategory(true) : set('category', v))}
              >
                <SelectTrigger className="border-line bg-paper-card w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {categoryList.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value={ADD_CATEGORY_VALUE} className="text-accent">
                    <span className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Add category
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date" className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Date</Label>
            <Input
              id="date"
              type="date"
              value={values.date}
              onChange={(e) => set('date', e.target.value)}
              className="border-line bg-paper-card"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="paymentMethod" className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Payment method</Label>
            <Link href="/manage" className="text-xs text-ink-faint hover:text-ink-soft flex items-center gap-1">
              <Settings2 className="h-3 w-3" /> Manage
            </Link>
          </div>
          <Input
            id="paymentMethod"
            value={values.paymentMethod}
            onChange={(e) => set('paymentMethod', e.target.value)}
            placeholder="e.g. Chase Sapphire, Cash"
            className="border-line bg-paper-card"
          />
          {paymentMethods.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {paymentMethods.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => set('paymentMethod', name)}
                  className={cn(
                    'text-xs px-3 py-1.5 transition-colors',
                    values.paymentMethod === name ? 'bg-accent text-white' : 'bg-sand text-ink-soft'
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowMore((s) => !s)}
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-ink-faint hover:text-ink-soft transition-colors"
        >
          More details <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showMore && 'rotate-180')} />
        </button>

        {showMore && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Description</Label>
              <Input
                id="description"
                value={values.description}
                onChange={(e) => set('description', e.target.value)}
                className="border-line bg-paper-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Notes</Label>
              <Textarea
                id="notes"
                value={values.notes}
                onChange={(e) => set('notes', e.target.value)}
                className="border-line bg-paper-card min-h-[70px] resize-none"
              />
            </div>
            {values.items && values.items.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Items found on receipt</Label>
                <div className="border border-line divide-y divide-line">
                  {values.items.map((item, i) => (
                    <div key={i} className="flex justify-between px-3 py-2 text-sm">
                      <span className="text-ink-soft truncate pr-2">{item.name}</span>
                      <span className="text-ink tabular-nums shrink-0">
                        {item.price != null ? `$${item.price.toFixed(2)}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" className="flex-1 h-12 border-line" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="flex-1 h-12 bg-accent hover:bg-accent/90 text-white text-sm font-semibold uppercase tracking-widest"
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : saveLabel}
        </Button>
      </div>
    </div>
  );
}
