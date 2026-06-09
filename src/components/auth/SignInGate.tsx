'use client';

import { LogIn } from 'lucide-react';

import { useSession } from '@/components/auth/session-context';

/**
 * The honest face of the owner-scoped data model: when auth is on and nobody is
 * signed in, a surface shows this instead of an empty list or a failed fetch.
 * The Rosin `Sign in` is the single primary action here, so the topbar keeps a
 * quieter Ebony sign-in (one accent per surface).
 */
export function SignInGate({
  title = 'Your library lives behind a sign-in.',
  description = 'WereCode keeps each musician’s songs private. Sign in to open yours.',
}: {
  title?: string;
  description?: string;
}) {
  const { signIn, busy, error } = useSession();

  return (
    <div className="surface wc-rise grid min-h-[420px] place-items-center px-6 py-16 text-center">
      <div className="max-w-md">
        <span className="wc-logo-mark mx-auto" />
        <h1 className="display mt-5 text-balance text-[clamp(28px,5vw,40px)]">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-7 text-[var(--muted)]">{description}</p>
        <button
          type="button"
          onClick={() => void signIn()}
          disabled={busy}
          className="pill accent mx-auto mt-6"
        >
          <span className="dot">
            <LogIn className="h-3.5 w-3.5" />
          </span>
          {busy ? 'Opening Google…' : 'Sign in with Google'}
        </button>
        {error ? <p className="mt-3 text-xs text-[var(--danger)]">{error}</p> : null}
      </div>
    </div>
  );
}
