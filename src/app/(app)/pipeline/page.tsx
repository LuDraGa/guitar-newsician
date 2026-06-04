import { AppShell } from '@/components/shell/AppShell';
import { PipelineClient } from '@/features/pipeline/PipelineClient';

export default function PipelinePage() {
  return (
    <AppShell>
      <PipelineClient />
    </AppShell>
  );
}
