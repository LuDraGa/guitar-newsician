import type { Metadata } from 'next';

import { MarketingLanding } from '@/features/marketing/MarketingLanding';

export const metadata: Metadata = {
  title: 'Octave — Maestro teaches the song you want to play.',
  description:
    'Octave is a guitar-first system where Maestro studies a recording, turns the evidence into a songbook, and guides you toward playing it on guitar.',
};

export default function HomePage() {
  return <MarketingLanding />;
}
