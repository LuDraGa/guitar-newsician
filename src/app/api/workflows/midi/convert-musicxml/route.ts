import { NextRequest, NextResponse } from 'next/server';

import { routeErrorResponse } from '@/lib/http/route-error';
import { convertNoteEventsToMusicXml, musicXmlWorkflowSchema } from '@/server/werecode/product-workflows';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = musicXmlWorkflowSchema.parse(await request.json().catch(() => null));
    const result = await convertNoteEventsToMusicXml(body);

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, 'Could not convert note events to MusicXML');
  }
}
