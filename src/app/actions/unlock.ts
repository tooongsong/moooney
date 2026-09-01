'use server';

import { cookies } from 'next/headers';
import { computeToken, getExpectedToken, COOKIE_NAME } from '@/lib/pin';

export async function unlock(pin: string) {
  const expected = await getExpectedToken();
  if (!expected) return { success: true };

  const submitted = await computeToken(pin);
  if (submitted !== expected) {
    return { success: false, error: 'Incorrect PIN' };
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });

  return { success: true };
}
