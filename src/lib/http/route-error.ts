import { ZodError } from 'zod';

import { jsonError } from '@/lib/http/responses';
import { AuthRequiredError } from '@/lib/supabase/auth';

export function routeErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof ZodError) {
    return jsonError('Invalid request body', {
      status: 400,
      code: 'invalid_request',
      details: error.flatten(),
    });
  }

  if (error instanceof AuthRequiredError) {
    return jsonError(error.message, {
      status: error.status,
      code: error.code,
    });
  }

  return jsonError(fallbackMessage, {
    status: 500,
    code: 'route_failed',
    details: {
      message: error instanceof Error ? error.message : 'Unknown route error',
    },
  });
}
