import { AppShell } from '@/components/shell/AppShell';
import { StudioClient } from '@/features/studio/StudioClient';

type StudioSongPageProps = {
  params: Promise<{
    songId: string;
  }>;
};

export default async function StudioSongPage({ params }: StudioSongPageProps) {
  const { songId } = await params;

  return (
    <AppShell>
      <StudioClient initialSongId={songId} />
    </AppShell>
  );
}
