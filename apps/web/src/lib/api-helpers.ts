import { NextResponse } from 'next/server';
import { auth } from './auth';
import { ForbiddenError, UnauthorizedError } from './rbac';
import type { ZodError } from 'zod';

/** Get the current session's user id, or null if unauthenticated. */
export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Convert a thrown error from a route handler into a NextResponse with an
 * appropriate status code. Handles RBAC errors, Zod validation errors, and
 * falls back to 500 for anything unexpected.
 */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (isZodError(error)) {
    return NextResponse.json(
      { error: 'Validation failed', details: error.flatten() },
      { status: 400 }
    );
  }
  if (error instanceof Error && (error as { code?: string }).code === 'P2025') {
    // Prisma "record not found"
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (error instanceof Error && (error as { code?: string }).code === 'P2002') {
    // Prisma "unique constraint violation"
    return NextResponse.json({ error: 'Already exists' }, { status: 409 });
  }

  console.error('Unhandled API error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

function isZodError(error: unknown): error is ZodError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'issues' in error &&
    'flatten' in error
  );
}

export const unauthorized = () =>
  NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
