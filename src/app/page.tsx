import Link from "next/link";

import { AppShell } from "@/components/shell/AppShell";
import { getModalApiInfo, getModalModels } from "@/lib/modal/client";

export default async function HomePage() {
  const [apiInfo, models] = await Promise.allSettled([getModalApiInfo(), getModalModels()]);

  const modalEndpointCount =
    apiInfo.status === "fulfilled" ? apiInfo.value.endpoints.length : "unavailable";
  const modelCount = models.status === "fulfilled" ? models.value.models.length : "unavailable";

  return (
    <AppShell>
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div>
            <p className="muted text-sm">Next.js migration shell</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-normal text-white">
              One Vercel app for WereCode, with Modal handling the heavy music compute.
            </h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/library"
              className="surface block p-5 transition hover:border-[var(--accent)]"
            >
              <div className="text-sm text-[var(--accent-strong)]">Library</div>
              <div className="mt-2 text-lg font-medium">Songs, jobs, and artifacts</div>
              <p className="muted mt-2 text-sm">
                Supabase-backed song rows and storage assets will land here first.
              </p>
            </Link>
            <Link
              href="/studio"
              className="surface block p-5 transition hover:border-[var(--accent)]"
            >
              <div className="text-sm text-[var(--accent-strong)]">Studio</div>
              <div className="mt-2 text-lg font-medium">Analysis, stems, lyrics, MIDI</div>
              <p className="muted mt-2 text-sm">
                The Vite studio panels and design references will be ported into this route.
              </p>
            </Link>
          </div>
        </div>

        <aside className="surface h-fit p-5">
          <h2 className="text-lg font-medium">Modal gateway</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="muted">Endpoints</dt>
              <dd className="font-mono">{modalEndpointCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="muted">Models</dt>
              <dd className="font-mono">{modelCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="muted">Mode</dt>
              <dd className="font-mono">lazy compute</dd>
            </div>
          </dl>
        </aside>
      </section>
    </AppShell>
  );
}
