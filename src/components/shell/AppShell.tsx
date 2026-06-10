'use client';

import { LogIn, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { AuthButton } from '@/components/auth/AuthButton';
import { SessionProvider, useSession } from '@/components/auth/session-context';
import { CommandSearch } from '@/components/shell/CommandSearch';
import { PillIcon } from '@/components/werecode/WereCodePrimitives';
import { isPipelineEnabled } from '@/lib/flags';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Studio is the per-song workbench. Only `/app/studio/<id>` gets the fixed-height
  // workbench layout and the contextual coach; bare `/app/studio` is the picker and
  // scrolls like any other page.
  const inSongStudio = pathname.startsWith('/app/studio/');

  const navItems = isPipelineEnabled()
    ? ([
        { href: '/app/library', label: 'Library' },
        { href: '/app/studio', label: 'Studio' },
        { href: '/app/pipeline', label: 'Pipeline' },
      ] as const)
    : ([
        { href: '/app/library', label: 'Library' },
        { href: '/app/studio', label: 'Studio' },
      ] as const);

  function openCoach() {
    window.dispatchEvent(new CustomEvent('werecode:toggle-coach'));
  }

  return (
    <SessionProvider>
      <main className="page-shell">
        <style>{`
          .display,
          .pill,
          .segment button,
          .segment a {
            letter-spacing: 0;
          }
        `}</style>
        <header className="wc-topbar">
          <Link href="/app/library" className="flex items-center gap-3 justify-self-start">
            <span className="wc-logo-mark" />
            <span className="display text-[19px]">WereCode</span>
          </Link>

          <nav className="segment" aria-label="Primary">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} className={active ? 'on' : ''}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 justify-self-end">
            <CommandSearch />
            {inSongStudio && (
              <button type="button" onClick={openCoach} className="pill ghost sm wc-hide-mobile">
                <PillIcon>
                  <Sparkles className="h-3.5 w-3.5" />
                </PillIcon>
                Ask coach
              </button>
            )}
            <AuthButton />
          </div>
        </header>
        <ShellContent inSongStudio={inSongStudio}>{children}</ShellContent>
      </main>
    </SessionProvider>
  );
}

/**
 * The single soft auth gate for every `/app/*` surface. Lives inside the session
 * provider so it can read identity once and decide for the whole shell: signed in
 * renders the app untouched; signed out (with auth on) frosts the app content and
 * floats a sign-in CTA over it. Blur is applied via `filter` on the content box
 * itself — wrapping the children in an extra layout div would collapse the
 * fixed-height Studio flex layout, so we tint in place and overlay the CTA as a
 * sibling. This replaces the former per-surface sign-in gates.
 */
function ShellContent({
  inSongStudio,
  children,
}: {
  inSongStudio: boolean;
  children: React.ReactNode;
}) {
  const { session } = useSession();
  const locked = Boolean(session && session.authEnabled && !session.user);
  const contentClass = inSongStudio ? 'wc-content wc-content-studio' : 'wc-content';

  return (
    <>
      <div
        className={contentClass}
        aria-hidden={locked || undefined}
        style={
          locked
            ? { filter: 'blur(7px) saturate(0.85)', pointerEvents: 'none', userSelect: 'none' }
            : undefined
        }
      >
        {children}
      </div>
      {locked && <AppAuthGate />}
    </>
  );
}

function AppAuthGate() {
  const { signIn, busy, error } = useSession();

  return (
    <div className="fixed inset-x-0 bottom-0 top-[68px] z-20 grid place-items-center px-6">
      <div className="surface wc-rise w-full max-w-md p-8 text-center shadow-[var(--shadow-pop)]">
        <span className="wc-logo-mark mx-auto" />
        <h2 className="display mt-5 text-balance text-[clamp(24px,4vw,32px)]">
          Sign in to open your workbench.
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-7 text-[var(--muted)]">
          WereCode keeps each musician’s songs private. Sign in to reach your library and take a
          song to the bench.
        </p>
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
