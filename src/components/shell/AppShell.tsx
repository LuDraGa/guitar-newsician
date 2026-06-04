'use client';

import { Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { AuthButton } from '@/components/auth/AuthButton';
import { PillIcon } from '@/components/werecode/WereCodePrimitives';

const navItems = [
  { href: '/library', label: 'Library' },
  { href: '/studio', label: 'Studio' },
  { href: '/pipeline', label: 'Pipeline' },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function toggleCoach() {
    if (pathname.startsWith('/studio')) {
      window.dispatchEvent(new CustomEvent('werecode:toggle-coach'));
      return;
    }

    router.push('/studio?coach=1');
  }

  return (
    <main className="page-shell">
      <header className="wc-topbar">
        <Link href="/library" className="flex items-center gap-3">
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

        <div className="flex items-center gap-2">
          <button type="button" className="iconbtn" aria-label="Search">
            <Search className="h-[18px] w-[18px]" />
          </button>
          <button type="button" onClick={toggleCoach} className="pill ghost sm wc-hide-mobile">
            <PillIcon>
              <Sparkles className="h-3.5 w-3.5" />
            </PillIcon>
            Ask coach
          </button>
          <AuthButton />
        </div>
      </header>
      <div className="wc-content">{children}</div>
    </main>
  );
}
