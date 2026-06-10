'use client';

/* ============================================================
   Marketing landing — the public front door at "/".
   Assembles the page, the waitlist modal, and the Concierge. The
   committed accent (rosin) and hero direction (bench) come straight
   from the design tokens in globals.css — there is no in-browser
   tweaks panel; the soft-launch direction is hardcoded.
   ============================================================ */
import { useCallback, useState } from 'react';

import './marketing.css';

import { Concierge } from './Concierge';
import { Contact, FinalCTA, Footer } from './MarketingContact';
import { MarketingHero } from './MarketingHero';
import { MarketingNav } from './MarketingNav';
import { FAQ, Features, ValueProps, WhoFor } from './MarketingSections';
import { WaitlistModal } from './WaitlistModal';

export function MarketingLanding() {
  const [wl, setWl] = useState<{ open: boolean; email: string }>({ open: false, email: '' });
  const openWaitlist = useCallback((email: string) => setWl({ open: true, email: email || '' }), []);
  const closeWaitlist = useCallback(() => setWl({ open: false, email: '' }), []);

  return (
    <div className="marketing">
      <div id="top" />
      <MarketingNav onJoin={openWaitlist} />
      <main>
        <MarketingHero onJoin={openWaitlist} />
        <ValueProps />
        <Features />
        <WhoFor />
        <FAQ />
        <Contact />
        <FinalCTA onJoin={openWaitlist} />
      </main>
      <Footer onJoin={openWaitlist} />

      <Concierge />
      {wl.open && <WaitlistModal prefillEmail={wl.email} onClose={closeWaitlist} />}
    </div>
  );
}
