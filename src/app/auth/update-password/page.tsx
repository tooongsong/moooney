'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) { setReady(true); return; }
    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setError(error.message);
      setReady(true);
    });
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push('/');
      router.refresh();
    }
  }

  if (!ready) return <p className="text-sm text-ink-faint">Verifying link…</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="password"
        required
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-4 py-2.5 border-2 border-line rounded-lg bg-paper text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink"
      />
      <input
        type="password"
        required
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full px-4 py-2.5 border-2 border-line rounded-lg bg-paper text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink"
      />
      {error && (
        <p className="text-xs text-accent bg-accent/10 rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-ink text-paper font-semibold rounded-lg text-sm hover:bg-ink/90 active:scale-95 transition-all disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Set password'}
      </button>
    </form>
  );
}

export default function UpdatePasswordPage() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-ink">moooney</h1>
          <p className="text-sm text-ink-soft">Set a new password</p>
        </div>
        <Suspense fallback={<p className="text-sm text-ink-faint">Loading…</p>}>
          <UpdatePasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
