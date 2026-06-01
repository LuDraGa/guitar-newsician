import { NextResponse } from 'next/server';

import { getAuthRuntimeState, getCurrentUser, toPublicUser } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const runtime = getAuthRuntimeState();

  if (!runtime.configured) {
    return NextResponse.json({
      ...runtime,
      user: null,
    });
  }

  const { user } = await getCurrentUser();

  return NextResponse.json({
    ...runtime,
    user: user ? toPublicUser(user) : null,
  });
}
