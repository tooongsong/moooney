'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AccountTypeIcon } from '@/components/AccountTypeIcon';
import { restorePaymentMethod } from '@/app/actions/settings';

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
}

export function ArchivedSection({ accounts }: { accounts: Account[] }) {
  const [list, setList] = useState(accounts);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  if (list.length === 0) return null;

  async function restore(id: string) {
    setRestoringId(id);
    await restorePaymentMethod(id);
    setList((prev) => prev.filter((a) => a.id !== id));
    setRestoringId(null);
  }

  return (
    <div className="rounded-2xl border border-line bg-paper-card divide-y divide-line overflow-hidden">
      {list.map((a) => (
        <div key={a.id} className="flex items-center justify-between px-4 py-2.5">
          <span className="flex items-center gap-2 min-w-0">
            <AccountTypeIcon type={a.type} className="h-3.5 w-3.5 text-ink-faint shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm text-ink truncate">{a.name}</span>
              {a.institution && <span className="block text-xs text-ink-faint truncate">{a.institution}</span>}
            </span>
          </span>
          <button
            type="button"
            onClick={() => restore(a.id)}
            disabled={restoringId === a.id}
            className="text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink transition-colors shrink-0 ml-3 flex items-center gap-1 disabled:opacity-40"
          >
            {restoringId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Restore
          </button>
        </div>
      ))}
    </div>
  );
}
