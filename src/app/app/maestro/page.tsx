import { redirect } from 'next/navigation';

import { AppShell } from '@/components/shell/AppShell';
import { MaestroClient } from '@/features/maestro/MaestroClient';
import { isMaestroEnabled } from '@/lib/flags';

export default function MaestroPage() {
  // Dev-only surface: hidden from the nav and unreachable by URL unless the flag
  // is on (local dev, or NEXT_PUBLIC_ENABLE_MAESTRO=true).
  if (!isMaestroEnabled()) {
    redirect('/app/library');
  }

  return (
    <AppShell>
      <MaestroClient />
    </AppShell>
  );
}
