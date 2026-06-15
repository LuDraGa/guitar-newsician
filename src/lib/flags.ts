/**
 * Build-time feature flags.
 *
 * These read `NEXT_PUBLIC_*` (inlined into the client bundle) and `NODE_ENV`,
 * so they evaluate identically on the server and in the browser. That lets a
 * single helper gate both a nav item (client) and a route guard (server)
 * without drift.
 */

/**
 * Pipeline is a developer-facing surface, not part of the musician product.
 * It shows automatically in local `next dev` and stays hidden everywhere else
 * (Vercel preview + production) unless explicitly turned on with
 * `NEXT_PUBLIC_ENABLE_PIPELINE=true`.
 *
 * Note: `VERCEL_ENV` is intentionally not consulted here because it is not
 * exposed to the client bundle; relying on it would make the nav and the route
 * guard disagree.
 */
export function isPipelineEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_PIPELINE === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}

/**
 * Maestro is the in-product guitar-learning coach, built behind a developer flag
 * exactly like Pipeline: on automatically in local `next dev`, hidden on Vercel
 * preview + production unless `NEXT_PUBLIC_ENABLE_MAESTRO=true`. One helper gates
 * both the nav item (client) and the `/app/maestro` route guard (server) so they
 * cannot disagree. See docs/maestro/maestro-build-flow.md §2.
 */
export function isMaestroEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_MAESTRO === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}
