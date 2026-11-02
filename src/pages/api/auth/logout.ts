import type { APIRoute } from 'astro';
import { SESSION_COOKIE } from '../../../lib/auth';
import { destroySession } from '../../../lib/db';

export const POST: APIRoute = async ({ cookies, locals, redirect, url }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  const db = locals.runtime?.env?.DB;
  if (token && db) await destroySession(db, token);
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect(url.origin + '/', 303);
};
