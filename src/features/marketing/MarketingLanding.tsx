'use client';

/* ============================================================
   Marketing landing — the public front door at "/".
   Five scenes on the lamplit-bench (dark) theme: hero → the bench
   → Maestro → fit + FAQ → final CTA, with contact folded into the
   footer. Inline email captures join the waitlist immediately and
   then open the modal on its success state for the optional
   profile questions; nav/footer open the modal at the email step.
   ============================================================ */
import { useCallback, useState } from 'react';

import './marketing.css';

import { TheBench } from './BenchScene';
import { Concierge } from './Concierge';
import { FinalCTA, Footer } from './MarketingContact';
import { MarketingHero } from './MarketingHero';
import { MarketingNav } from './MarketingNav';
import { FitAndFaq, MaestroScene } from './MarketingSections';
import { WaitlistModal } from './WaitlistModal';

export function MarketingLanding() {
  const [wl, setWl] = useState<{ open: boolean; email: string; joined: boolean }>({
    open: false,
    email: '',
    joined: false,
  });
  // nav/footer: nothing captured yet — modal starts at the email step
  const openWaitlist = useCallback(() => setWl({ open: true, email: '', joined: false }), []);
  // inline captures: already joined — modal opens on the success state
  const openJoined = useCallback((email: string) => setWl({ open: true, email, joined: true }), []);
  const closeWaitlist = useCallback(() => setWl({ open: false, email: '', joined: false }), []);

  return (
    <div className="marketing">
      <div id="top" />
      <MarketingNav onJoin={openWaitlist} />
      <main>
        <MarketingHero onJoined={openJoined} />
        <TheBench />
        <MaestroScene onJoined={openJoined} />
        <FitAndFaq />
        <FinalCTA onJoined={openJoined} />
      </main>
      <Footer onJoin={openWaitlist} />

      <Concierge />
      {wl.open && <WaitlistModal prefillEmail={wl.email} startJoined={wl.joined} onClose={closeWaitlist} />}
    </div>
  );
}
