import { AppShell } from "@/components/shell/AppShell";
import { StudioClient } from "@/features/studio/StudioClient";

type StudioPageProps = {
  searchParams: Promise<{
    songId?: string;
  }>;
};

export default async function StudioPage({ searchParams }: StudioPageProps) {
  const params = await searchParams;

  return (
    <AppShell>
      <StudioClient initialSongId={params.songId} />
    </AppShell>
  );
}
