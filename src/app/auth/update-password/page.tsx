'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [exchangeError, setExchangeError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const supabase = createClient(); // singleton
    if (!code) {
      // Already have a session? (e.g. came from server-side exchange)
      supabase.auth.getSession().then(({ data: { session } }) => {
        setStatus(session ? 'ready' : 'error');
        if (!session) setExchangeError('No valid reset link. Request a new password reset email.');
      });
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
      if (error || !data.session) {
        setExchangeError(error?.message ?? 'Reset link is invalid or expired. Request a new one.');
        setStatus('error');
      } else {
        setStatus('ready');
      }
    });
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setSubmitError('Passwords do not match.'); return; }
    if (password.length < 6) { setSubmitError('Password must be at least 6 characters.'); return; }
    setSubmitError('');
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setSubmitError(error.message);
    } else {
      router.push('/');
      router.refresh();
    }
  }

  if (status === 'loading') {
    return <p className="text-sm text-ink-faint">Verifying link…</p>;
  }

  if (status === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-accent bg-accent/10 rounded-lg px-3 py-2">{exchangeError}</p>
        <a href="/login" className="block text-center text-xs text-ink-faint hover:text-ink underline underline-offset-4">
          Back to login
        </a>
      </div>
    );
  }

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
      {submitError && (
        <p className="text-xs text-accent bg-accent/10 rounded-lg px-3 py-2">{submitError}</p>
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
