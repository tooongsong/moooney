'use client';

import { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { AccountTypeIcon } from '@/components/AccountTypeIcon';
import { ACCOUNT_TYPES, type AccountType } from '@/lib/accountTypes';
import { cn } from '@/lib/utils';

interface Item {
  id: string;
  name: string;
  subtitle?: string;
  type?: string;
  institution?: string;
}

interface ManageListProps {
  title: string;
  description: string;
  placeholder: string;
  items: Item[];
  builtIn?: string[];
  withStartingBalance?: boolean;
  withAccountType?: boolean;
  onAdd: (name: string, startingBalance?: number, type?: AccountType, institution?: string, creditLimit?: number) => Promise<{ success: boolean; error?: string }>;
  onDelete: (id: string) => Promise<{ success: boolean }>;
}

export function ManageList({
  title,
  description,
  placeholder,
  items,
  builtIn,
  withStartingBalance,
  withAccountType,
  onAdd,
  onDelete,
}: ManageListProps) {
  const [list, setList] = useState(items);
  const [value, setValue] = useState('');
  const [balanceValue, setBalanceValue] = useState('');
  const [typeValue, setTypeValue] = useState<AccountType>('checking');
  const [institutionValue, setInstitutionValue] = useState('');
  const [creditLimitValue, setCreditLimitValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isCreditCard = typeValue === 'credit_card';

  async function handleAdd() {
    const name = value.trim();
    if (!name || isAdding) return;
    setIsAdding(true);
    const startingBalance = balanceValue ? parseFloat(balanceValue) : 0;
    const institution = institutionValue.trim() || undefined;
    const creditLimit = creditLimitValue ? parseFloat(creditLimitValue) : undefined;
    const result = await onAdd(
      name,
      startingBalance,
      withAccountType ? typeValue : undefined,
      institution,
      creditLimit,
    );
    setIsAdding(false);
    if (result.success) {
      setList((prev) =>
        [
          ...prev,
          {
            id: crypto.randomUUID(),
            name,
            subtitle: withStartingBalance ? `$${startingBalance.toFixed(2)}` : undefined,
            type: withAccountType ? typeValue : undefined,
            institution,
          },
        ].sort((a, b) => a.name.localeCompare(b.name))
      );
      setValue('');
      setBalanceValue('');
      setInstitutionValue('');
      setCreditLimitValue('');
    } else {
      toast.error(result.error || 'Could not add');
    }
  }

  function onEnter(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await onDelete(id);
    setDeletingId(null);
    if (result.success) {
      setList((prev) => prev.filter((item) => item.id !== id));
    } else {
      toast.error('Could not delete');
    }
  }

  return (
    <section>
      <h2 className="text-sm font-medium text-ink">{title}</h2>
      <p className="text-xs text-ink-faint mb-4">{description}</p>

      {/* Name + balance row */}
      <div className="flex gap-2 mb-3">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onEnter}
          placeholder={placeholder}
          className="rounded-xl border-line bg-paper-card text-sm h-10"
        />
        {withStartingBalance && (
          <Input
            value={balanceValue}
            onChange={(e) => setBalanceValue(e.target.value.replace(/[^0-9.-]/g, ''))}
            onKeyDown={onEnter}
            inputMode="decimal"
            placeholder="Balance"
            className="rounded-xl border-line bg-paper-card text-sm h-10 w-24 shrink-0"
          />
        )}
        <button
          type="button"
          onClick={handleAdd}
          disabled={!value.trim() || isAdding}
          className="w-10 h-10 shrink-0 rounded-xl bg-accent text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-transform"
        >
          {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>

      {/* Account type pills */}
      {withAccountType && (
        <div className="flex flex-wrap gap-2 mb-3">
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTypeValue(t.value)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 transition-colors',
                typeValue === t.value ? 'bg-accent text-white' : 'bg-sand text-ink-soft'
              )}
            >
              <AccountTypeIcon type={t.value} className="h-3 w-3" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Institution + credit limit (only for account type form) */}
      {withAccountType && (
        <div className="flex gap-2 mb-4">
          <Input
            value={institutionValue}
            onChange={(e) => setInstitutionValue(e.target.value)}
            onKeyDown={onEnter}
            placeholder="Institution (optional)"
            className="rounded-xl border-line bg-paper-card text-sm h-10"
          />
          {isCreditCard && (
            <Input
              value={creditLimitValue}
              onChange={(e) => setCreditLimitValue(e.target.value.replace(/[^0-9.]/g, ''))}
              onKeyDown={onEnter}
              inputMode="decimal"
              placeholder="Credit limit"
              className="rounded-xl border-line bg-paper-card text-sm h-10 w-32 shrink-0"
            />
          )}
        </div>
      )}

      {/* Built-in items */}
      {builtIn && builtIn.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {builtIn.map((name) => (
            <span key={name} className="text-xs font-semibold uppercase tracking-wide text-ink-soft bg-sand px-3 py-1.5">
              {name}
            </span>
          ))}
        </div>
      )}

      {/* Account list */}
      {list.length > 0 && (
        <div className="rounded-2xl border border-line bg-paper-card divide-y divide-line overflow-hidden">
          {list.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="flex items-center gap-2 min-w-0">
                {withAccountType && item.type && <AccountTypeIcon type={item.type} className="h-3.5 w-3.5 text-ink-faint shrink-0" />}
                <span className="min-w-0">
                  <span className="block text-sm text-ink truncate">{item.name}</span>
                  {item.institution && (
                    <span className="block text-xs text-ink-faint truncate">{item.institution}</span>
                  )}
                </span>
              </span>
              <div className="flex items-center gap-3 shrink-0">
                {item.subtitle && <span className="text-xs text-ink-faint tabular-nums">{item.subtitle}</span>}
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-ink-faint hover:text-accent hover:bg-accent/10 transition-colors"
                >
                  {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
