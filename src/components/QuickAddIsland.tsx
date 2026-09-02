'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn, toDateInputValue } from '@/lib/utils';
import { saveTransaction } from '@/app/actions/transactions';
import { getAllCategories, getPaymentMethodNames } from '@/app/actions/manage';
import { DEFAULT_CATEGORY } from '@/lib/categories';

export function QuickAddIsland() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded && !dataLoaded) {
      Promise.all([getAllCategories(), getPaymentMethodNames()]).then(([cats, meths]) => {
        setCategories(cats);
        setMethods(meths);
        if (meths.length === 1) setPaymentMethod(meths[0]);
        setDataLoaded(true);
      });
    }
    if (expanded) {
      const t = setTimeout(() => amountRef.current?.focus(), 380);
      return () => clearTimeout(t);
    }
  }, [expanded, dataLoaded]);

  function close() {
    setExpanded(false);
    setTimeout(() => {
      setAmount('');
      setMerchant('');
      setCategory(DEFAULT_CATEGORY);
      setPaymentMethod('');
      setSaved(false);
    }, 420);
  }

  const amountNumber = parseFloat(amount);
  const canSave =
    !isNaN(amountNumber) && amountNumber > 0 && merchant.trim().length > 0 && !isSaving && !saved;

  async function handleSave() {
    if (!canSave) return;
    setIsSaving(true);
    const result = await saveTransaction({
      amount: amountNumber,
      merchant: merchant.trim(),
      category,
      date: toDateInputValue(),
      type: 'expense',
      description: merchant.trim(),
      paymentMethod: paymentMethod || null,
      notes: null,
      items: null,
      receiptImage: null,
      needsReview: false,
    });
    setIsSaving(false);
    if (result.success) {
      setSaved(true);
      setTimeout(() => {
        close();
        router.refresh();
      }, 700);
    } else {
      toast.error(result.error || 'Could not save');
    }
  }

  const chipBase =
    'shrink-0 h-7 px-3 rounded-full text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors';

  return (
    <div className="flex justify-center mt-4 mb-1">
      <div
        className="bg-ink text-paper overflow-hidden"
        style={{
          borderRadius: expanded ? '20px' : '9999px',
          width: expanded ? '100%' : '6rem',
          maxHeight: expanded ? '520px' : '2.5rem',
          transition: [
            'border-radius 380ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            'width 380ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            'max-height 420ms cubic-bezier(0.25, 1, 0.5, 1)',
          ].join(', '),
        }}
      >
        {/* Top 40px — shared between pill trigger and form header */}
        <div className="relative h-10">
          {/* Collapsed: pill trigger */}
          <button
            onClick={() => setExpanded(true)}
            aria-label="Quick add expense"
            className="absolute inset-0 flex items-center justify-center gap-1.5 w-full"
            style={{
              opacity: expanded ? 0 : 1,
              pointerEvents: expanded ? 'none' : 'auto',
              transition: 'opacity 150ms ease',
            }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Add</span>
          </button>

          {/* Expanded: form header */}
          <div
            className="absolute inset-0 flex items-center justify-between px-5"
            style={{
              opacity: expanded ? 1 : 0,
              pointerEvents: expanded ? 'auto' : 'none',
              transition: expanded ? 'opacity 200ms ease 180ms' : 'opacity 100ms ease',
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-paper/50">
              Quick add
            </span>
            <button
              onClick={close}
              className="p-1 -mr-1 text-paper/50 hover:text-paper transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Form body */}
        <div
          className="px-5 pb-5"
          style={{
            opacity: expanded ? 1 : 0,
            pointerEvents: expanded ? 'auto' : 'none',
            transition: expanded ? 'opacity 220ms ease 180ms' : 'opacity 100ms ease',
          }}
        >
          {/* Amount */}
          <div className="flex items-end gap-1 mb-5">
            <span className="text-2xl text-paper/30 font-light mb-0.5 leading-none">$</span>
            <input
              ref={amountRef}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSave) handleSave(); }}
              placeholder="0.00"
              className="flex-1 text-5xl font-bold tracking-tighter bg-transparent outline-none placeholder:text-paper/20 text-paper leading-none min-w-0"
            />
          </div>

          {/* Merchant */}
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSave) handleSave(); }}
            placeholder="Where?"
            className="w-full text-base font-medium rounded-xl px-4 h-11 outline-none placeholder:text-paper/30 text-paper mb-4"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          />

          {/* Category chips */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 mb-3">
              {categories.slice(0, 7).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(chipBase, category === c ? 'bg-paper text-ink' : 'text-paper/60')}
                  style={category !== c ? { background: 'rgba(255,255,255,0.1)' } : {}}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Payment method chips */}
          {methods.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 mb-5">
              {methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(paymentMethod === m ? '' : m)}
                  className={cn(chipBase, paymentMethod === m ? 'bg-paper text-ink' : 'text-paper/60')}
                  style={paymentMethod !== m ? { background: 'rgba(255,255,255,0.1)' } : {}}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="w-full h-12 rounded-xl bg-accent text-white text-sm font-bold uppercase tracking-widest flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-30"
          >
            {isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : saved ? (
              <Check className="h-5 w-5" />
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
