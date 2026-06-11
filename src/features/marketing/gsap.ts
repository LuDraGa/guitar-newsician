/* Single GSAP entry for the marketing landing: one registration, one
   import path. ScrollTrigger registration is guarded so the module can
   be evaluated during SSR of client components. */
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export { gsap, ScrollTrigger, useGSAP };
