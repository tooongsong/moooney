'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Session was established server-side in /auth/callback
    createClient().auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        setSessionError('No valid session. Please request a new password reset email.');
      }
      setReady(true);
    });
  }, []);

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

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-ink">moooney</h1>
          <p className="text-sm text-ink-soft">Set a new password</p>
        </div>

        {!ready ? (
          <p className="text-sm text-ink-faint">Verifying…</p>
        ) : sessionError ? (
          <div className="space-y-3">
            <p className="text-xs text-accent bg-accent/10 rounded-lg px-3 py-2">{sessionError}</p>
            <a href="/login" className="block text-center text-xs text-ink-faint hover:text-ink underline underline-offset-4">
              Back to login
            </a>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
