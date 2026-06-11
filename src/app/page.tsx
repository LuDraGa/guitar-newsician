import type { Metadata } from 'next';

import { MarketingLanding } from '@/features/marketing/MarketingLanding';

export const metadata: Metadata = {
  title: 'Octave — Take a song apart. Learn it piece by piece.',
  description:
    'You can play — Octave helps you play that song. It pulls a recording apart into parts, chords, and words so you learn it piece by piece, with Maestro, a coach that talks like a musician.',
};

export default function HomePage() {
  return <MarketingLanding />;
}
