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
