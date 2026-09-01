import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function makeSupabase(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  // Safety: only allow relative redirects
  const destination = next.startsWith('/') ? `${origin}${next}` : `${origin}/`;

  if (tokenHash && type === 'recovery') {
    const response = NextResponse.redirect(`${origin}/auth/update-password`);
    const supabase = makeSupabase(request, response);
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    return response;
  }

  if (code) {
    const response = NextResponse.redirect(destination);
    const supabase = makeSupabase(request, response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
    // Exchange failed — redirect to login with error
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}/`);
}
