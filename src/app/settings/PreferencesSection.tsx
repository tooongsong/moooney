'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { updatePreferences } from '@/app/actions/settings';

const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'CNY', label: 'CNY — Chinese Yuan' },
  { code: 'HKD', label: 'HKD — Hong Kong Dollar' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'KRW', label: 'KRW — Korean Won' },
  { code: 'MXN', label: 'MXN — Mexican Peso' },
  { code: 'BRL', label: 'BRL — Brazilian Real' },
];

interface Props {
  currency: string;
  defaultAccount: string;
  accountNames: string[];
}

export function PreferencesSection({ currency: initCurrency, defaultAccount: initAccount, accountNames }: Props) {
  const [currency, setCurrency]       = useState(initCurrency);
  const [defaultAccount, setDefaultAccount] = useState(initAccount);

  async function save(updates: { currency?: string; defaultAccount?: string }) {
    const res = await updatePreferences(updates);
    if (!res.success) toast.error(res.error || 'Could not save');
  }

  return (
    <div className="divide-y divide-line">
      <div className="py-3 flex items-center justify-between">
        <span className="text-sm text-ink">Currency</span>
        <select
          value={currency}
          onChange={async (e) => {
            setCurrency(e.target.value);
            await save({ currency: e.target.value });
          }}
          className="text-sm text-ink-faint bg-transparent outline-none text-right appearance-none cursor-pointer"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="py-3 flex items-center justify-between">
        <span className="text-sm text-ink">Default Account</span>
        <select
          value={defaultAccount}
          onChange={async (e) => {
            setDefaultAccount(e.target.value);
            await save({ defaultAccount: e.target.value });
          }}
          className="text-sm text-ink-faint bg-transparent outline-none text-right appearance-none cursor-pointer"
        >
          <option value="">None</option>
          {accountNames.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
