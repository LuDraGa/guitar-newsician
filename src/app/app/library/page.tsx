import { AppShell } from "@/components/shell/AppShell";
import { LibraryClient } from "@/features/library/LibraryClient";

export default function LibraryPage() {
  return (
    <AppShell>
      <LibraryClient />
    </AppShell>
  );
}
