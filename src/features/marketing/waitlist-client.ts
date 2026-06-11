/* Client for the waitlist endpoint. Joining is a single POST keyed on
   email; a later POST with the same email merges optional profile fields
   into the existing row (the route only writes provided columns). */

export type WaitlistSource = 'hero' | 'maestro' | 'final' | 'nav' | 'footer' | 'modal';

export interface WaitlistPayload {
  email: string;
  source?: WaitlistSource;
  name?: string;
  instrument?: string;
  skill?: string;
  song?: string;
  heard?: string;
}

export async function joinWaitlist(payload: WaitlistPayload): Promise<void> {
  const body: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' && value.trim()) {
      body[key] = value.trim();
    }
  }

  const res = await fetch('/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Waitlist signup failed (${res.status})`);
  }
}
