/**
 * Auth. Deliberately small: a shared invite code, a stage name, a password.
 * No email, no reset flow, no verification — this is a group of friends.
 *
 * PBKDF2 via WebCrypto so there's no npm dependency to drag into the Worker.
 */

const ITERATIONS = 100_000;
const KEY_BITS = 256;
export const SESSION_COOKIE = 'df_session';
export const SESSION_DAYS = 365;

const b64 = (buf: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_BITS,
  );
  return b64(bits);
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: await derive(password, salt), salt: b64(salt.buffer) };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const candidate = await derive(password, unb64(salt));
  // Constant-time-ish compare. Cheap, and there's no reason not to.
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export function newToken(): string {
  return b64(crypto.getRandomValues(new Uint8Array(32)).buffer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function sessionCookie(token: string, secure = true): string {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join('; ');
}

export function clearCookie(secure = true): string {
  return [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', secure ? 'Secure' : '', 'Max-Age=0']
    .filter(Boolean)
    .join('; ');
}

/** Stage names: visible, memorable, and safe in a URL. */
export function validateHandle(raw: string): { ok: true; handle: string } | { ok: false; error: string } {
  const handle = raw.trim().replace(/\s+/g, ' ');
  if (handle.length < 2) return { ok: false, error: 'Stage name needs at least 2 characters.' };
  if (handle.length > 24) return { ok: false, error: 'Stage name maxes out at 24 characters.' };
  if (!/^[\p{L}\p{N} '._-]+$/u.test(handle))
    return { ok: false, error: "Letters, numbers, spaces and ' . _ - only." };
  return { ok: true, handle };
}

export function validatePassword(raw: string): { ok: true } | { ok: false; error: string } {
  if (raw.length < 6) return { ok: false, error: 'Password needs at least 6 characters.' };
  if (raw.length > 200) return { ok: false, error: 'That password is absurdly long.' };
  return { ok: true };
}
