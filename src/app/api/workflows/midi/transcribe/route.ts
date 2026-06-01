import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { midiTranscribeWorkflowSchema, runMidiTranscribeWorkflow } from '@/server/werecode/modal-workflows';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = midiTranscribeWorkflowSchema.parse(await request.json().catch(() => null));
    const result = await runMidiTranscribeWorkflow(body);

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, 'Could not transcribe MIDI');
  }
}
