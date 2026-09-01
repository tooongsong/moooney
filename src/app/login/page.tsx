'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push('/');
      router.refresh();
    }
  }

  async function handleResetPassword() {
    if (!email) { setError('Enter your email above first.'); return; }
    setResetting(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/update-password`,
    });
    setResetting(false);
    if (error) {
      setError(error.message);
    } else {
      setResetMsg('Check your email for a password reset link.');
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-ink">moooney</h1>
          <p className="text-sm text-ink-soft">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 border-2 border-line rounded-lg bg-paper text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 border-2 border-line rounded-lg bg-paper text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink"
          />

          {error && (
            <p className="text-xs text-accent bg-accent/10 rounded-lg px-3 py-2">{error}</p>
          )}
          {resetMsg && (
            <p className="text-xs text-ink-soft bg-sand rounded-lg px-3 py-2">{resetMsg}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-ink text-paper font-semibold rounded-lg text-sm hover:bg-ink/90 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleResetPassword}
          disabled={resetting}
          className="w-full text-xs text-ink-faint hover:text-ink underline underline-offset-4 transition-colors disabled:opacity-50"
        >
          {resetting ? 'Sending…' : 'Forgot or never set a password? Send reset email'}
        </button>
      </div>
    </div>
  );
}
