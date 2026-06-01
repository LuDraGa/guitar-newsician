import Link from "next/link";

import { AuthButton } from "@/components/auth/AuthButton";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/library", label: "Library" },
  { href: "/studio", label: "Studio" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="page-shell">
      <header className="border-b border-white/10">
        <div className="app-frame flex h-16 items-center justify-between">
          <Link href="/" className="text-base font-semibold tracking-normal">
            WereCode
          </Link>
          <nav className="flex items-center gap-1 text-sm text-slate-300">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <AuthButton />
        </div>
      </header>
      <div className="app-frame py-8">{children}</div>
    </main>
  );
}
