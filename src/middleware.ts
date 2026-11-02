import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE } from './lib/auth';
import { userFromToken } from './lib/db';

/** Routes that bounce you to the splash if you're not signed in. */
const PROTECTED = [/^\/setlist/, /^\/billboard/, /^\/me/, /^\/api\/workout/, /^\/api\/billboard/];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const db = ctx.locals.runtime?.env?.DB;
  const token = ctx.cookies.get(SESSION_COOKIE)?.value;

  ctx.locals.user = db ? await userFromToken(db, token) : null;

  const { pathname } = ctx.url;
  if (!ctx.locals.user && PROTECTED.some((re) => re.test(pathname))) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Not signed in.' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    return ctx.redirect('/?next=' + encodeURIComponent(pathname), 302);
  }

  return next();
});
