import type { Metadata } from 'next';

import { MarketingLanding } from '@/features/marketing/MarketingLanding';

export const metadata: Metadata = {
  title: 'Octave — Take any song to the woodshed',
  description:
    'Octave pulls any recording apart — stems, chords, tab, and sheet — with Maestro, an agent that talks you through the hard parts. A workbench for players past the basics.',
};

export default function HomePage() {
  return <MarketingLanding />;
}
