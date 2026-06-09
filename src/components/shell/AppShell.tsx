'use client';

import { Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { AuthButton } from '@/components/auth/AuthButton';
import { SessionProvider } from '@/components/auth/session-context';
import { PillIcon } from '@/components/werecode/WereCodePrimitives';
import { isPipelineEnabled } from '@/lib/flags';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Studio is the per-song workbench. Only `/studio/<id>` gets the fixed-height
  // workbench layout and the contextual coach; bare `/studio` is the picker and
  // scrolls like any other page.
  const inSongStudio = pathname.startsWith('/studio/');

  const navItems = isPipelineEnabled()
    ? ([
        { href: '/library', label: 'Library' },
        { href: '/studio', label: 'Studio' },
        { href: '/pipeline', label: 'Pipeline' },
      ] as const)
    : ([
        { href: '/library', label: 'Library' },
        { href: '/studio', label: 'Studio' },
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
          <Link href="/library" className="flex items-center gap-3 justify-self-start">
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
            <button type="button" className="iconbtn" aria-label="Search">
              <Search className="h-[18px] w-[18px]" />
            </button>
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
        <div className={inSongStudio ? 'wc-content wc-content-studio' : 'wc-content'}>{children}</div>
      </main>
    </SessionProvider>
  );
}
