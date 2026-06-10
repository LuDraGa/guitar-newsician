import { redirect } from 'next/navigation';

import { AppShell } from '@/components/shell/AppShell';
import { PipelineClient } from '@/features/pipeline/PipelineClient';
import { isPipelineEnabled } from '@/lib/flags';

export default function PipelinePage() {
  // Dev-only surface: hidden from the nav and unreachable by URL unless the flag
  // is on (local dev, or NEXT_PUBLIC_ENABLE_PIPELINE=true).
  if (!isPipelineEnabled()) {
    redirect('/app/library');
  }

  return (
    <AppShell>
      <PipelineClient />
    </AppShell>
  );
}
