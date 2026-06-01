import { NextResponse } from 'next/server';

export function jsonError(
  message: string,
  options: {
    status?: number;
    code?: string;
    details?: unknown;
  } = {}
) {
  return NextResponse.json(
    {
      error: {
        code: options.code ?? 'request_failed',
        message,
        details: options.details,
      },
    },
    { status: options.status ?? 400 }
  );
}
