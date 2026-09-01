import { signIn, signUp } from '@/app/actions/auth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-ink">moooney</h1>
          <p className="text-sm text-ink-soft">Sign in to your account</p>
        </div>

        <form action={signIn} className="space-y-4">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="space-y-2">
            <input
              name="email"
              type="email"
              placeholder="Email"
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 border-2 border-ink rounded-lg bg-paper text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink/20 text-sm"
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              required
              autoComplete="current-password"
              className="w-full px-3 py-2.5 border-2 border-ink rounded-lg bg-paper text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink/20 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-ink text-paper font-semibold rounded-lg text-sm hover:bg-ink/90 active:scale-95 transition-all"
          >
            Sign in
          </button>
        </form>

        <form action={signUp} className="space-y-4">
          <div className="space-y-2">
            <input
              name="email"
              type="email"
              placeholder="Email"
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 border-2 border-ink rounded-lg bg-paper text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink/20 text-sm"
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              required
              autoComplete="new-password"
              className="w-full px-3 py-2.5 border-2 border-ink rounded-lg bg-paper text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink/20 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 border-2 border-ink text-ink font-semibold rounded-lg text-sm hover:bg-ink/5 active:scale-95 transition-all"
          >
            Create account
          </button>
        </form>
      </div>
    </div>
  );
}
