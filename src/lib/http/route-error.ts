import { ZodError } from 'zod';

import { jsonError } from '@/lib/http/responses';
import { AuthRequiredError } from '@/lib/supabase/auth';

export class RouteNotFoundError extends Error {
  readonly status = 404;
  readonly code: string;

  constructor(message = 'Resource not found', code = 'resource_not_found') {
    super(message);
    this.name = 'RouteNotFoundError';
    this.code = code;
  }
}

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

  if (error instanceof RouteNotFoundError) {
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
