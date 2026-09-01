export const COOKIE_NAME = 'moooney_unlocked';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// If APP_SECRET is not set, fall back to a random value generated at boot.
// Sessions won't survive server restarts, but no known string is exposed in the source.
const runtimeSecret = crypto.randomUUID();

function getSecret(): string {
  return process.env.APP_SECRET ?? runtimeSecret;
}

export async function computeToken(pin: string): Promise<string> {
  return sha256Hex(`${pin}:${getSecret()}`);
}

/** Returns null when no PIN is configured, meaning the app is unlocked for everyone. */
export async function getExpectedToken(): Promise<string | null> {
  const pin = process.env.APP_PIN;
  if (!pin) return null;
  return computeToken(pin);
}
