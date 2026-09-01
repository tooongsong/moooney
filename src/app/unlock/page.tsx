'use client';

import { useState, useTransition, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Delete, Lock } from 'lucide-react';
import { unlock } from '@/app/actions/unlock';
import { cn } from '@/lib/utils';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'];

function UnlockScreen() {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  function press(key: string) {
    if (isPending) return;
    setError(false);
    if (key === 'delete') {
      setDigits((d) => d.slice(0, -1));
    } else if (key) {
      setDigits((d) => (d.length < 12 ? d + key : d));
    }
  }

  function submit() {
    if (!digits || isPending) return;
    startTransition(async () => {
      const result = await unlock(digits);
      if (result.success) {
        router.push(next);
        router.refresh();
      } else {
        setError(true);
        setDigits('');
      }
    });
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6">
      <div className="w-11 h-11 bg-accent text-white flex items-center justify-center mb-5">
        <Lock className="h-5 w-5" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-ink mb-1">Enter PIN</h1>
      <p className={cn('text-sm mb-8 transition-colors', error ? 'text-accent' : 'text-ink-faint')}>
        {error ? 'Incorrect PIN, try again' : 'Unlock your ledger'}
      </p>

      <div className="flex items-center gap-3 mb-10 h-4">
        {Array.from({ length: Math.max(digits.length, 4) }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-3 h-3 rounded-full border transition-colors',
              i < digits.length ? 'bg-accent border-accent' : 'border-ink-faint'
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {KEYS.map((key, i) =>
          key === '' ? (
            <div key={i} className="w-16 h-16" />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              className="w-16 h-16 rounded-full bg-paper-card border border-line shadow-subtle flex items-center justify-center text-xl font-medium text-ink active:scale-95 active:bg-sand transition-transform"
            >
              {key === 'delete' ? <Delete className="h-5 w-5 text-ink-soft" /> : key}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!digits || isPending}
        className="w-full max-w-[220px] h-12 rounded-xl bg-accent text-white text-sm font-medium disabled:opacity-30 active:scale-[0.98] transition-transform"
      >
        {isPending ? 'Checking…' : 'Unlock'}
      </button>
    </div>
  );
}

export default function UnlockPage() {
  return (
    <Suspense>
      <UnlockScreen />
    </Suspense>
  );
}
