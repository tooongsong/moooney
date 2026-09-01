'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    let authError;
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      authError = error;
      if (!error) {
        setResetMsg('Account created! Check your email to confirm, then sign in.');
        setLoading(false);
        setMode('login');
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      authError = error;
    }
    setLoading(false);
    if (authError) {
      setError(authError.message);
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

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setResetMsg('');
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-ink">moooney</h1>
          <p className="text-sm text-ink-soft">
            {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border-2 border-line overflow-hidden">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${mode === 'login' ? 'bg-ink text-paper' : 'bg-paper text-ink-faint hover:text-ink'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${mode === 'signup' ? 'bg-ink text-paper' : 'bg-paper text-ink-faint hover:text-ink'}`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
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
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {mode === 'login' && (
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={resetting}
            className="w-full text-xs text-ink-faint hover:text-ink underline underline-offset-4 transition-colors disabled:opacity-50"
          >
            {resetting ? 'Sending…' : 'Forgot or never set a password? Send reset email'}
          </button>
        )}
      </div>
    </div>
  );
}
