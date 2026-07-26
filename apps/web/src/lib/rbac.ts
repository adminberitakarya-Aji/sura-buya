import { prisma } from './prisma';
import type { MemberRole } from '@prisma/client';

/**
 * RBAC (Role-Based Access Control) for universe-scoped resources.
 *
 * Roles (from most to least privileged):
 *   OWNER    - full control, can manage members, delete universe
 *   EDITOR   - can create/edit bible content, characters, regions, episodes
 *   REVIEWER - can approve/reject generated content, leave reviews
 *   VIEWER   - read-only access
 *
 * Global UserRole (ADMIN) always bypasses universe-level checks.
 */

export type Action =
  | 'universe:read'
  | 'universe:update'
  | 'universe:delete'
  | 'universe:manage-members'
  | 'content:read'
  | 'content:write'
  | 'content:delete'
  | 'review:write'
  | 'ai-config:read'
  | 'ai-config:write';

const ROLE_PERMISSIONS: Record<MemberRole, Action[]> = {
  OWNER: [
    'universe:read',
    'universe:update',
    'universe:delete',
    'universe:manage-members',
    'content:read',
    'content:write',
    'content:delete',
    'review:write',
    'ai-config:read',
    'ai-config:write',
  ],
  EDITOR: [
    'universe:read',
    'content:read',
    'content:write',
    'content:delete',
    'ai-config:read',
  ],
  REVIEWER: ['universe:read', 'content:read', 'review:write'],
  VIEWER: ['universe:read', 'content:read'],
};

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Resolve a user's effective role for a given universe.
 * Returns null if the user is not a member and is not a global ADMIN.
 */
export async function getUniverseRole(
  userId: string,
  universeId: string
): Promise<MemberRole | 'ADMIN' | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role === 'ADMIN') {
    return 'ADMIN';
  }

  const membership = await prisma.universeMember.findUnique({
    where: { userId_universeId: { userId, universeId } },
    select: { role: true },
  });

  return membership?.role ?? null;
}

/**
 * Check whether a user is allowed to perform `action` on `universeId`.
 * ADMIN users always pass. Returns false (not throw) so callers can
 * decide how to respond (redirect, 403 JSON, hide UI, etc).
 */
export async function can(
  userId: string,
  universeId: string,
  action: Action
): Promise<boolean> {
  const role = await getUniverseRole(userId, universeId);
  if (!role) return false;
  if (role === 'ADMIN') return true;
  return ROLE_PERMISSIONS[role].includes(action);
}

/**
 * Assert a user is allowed to perform `action` on `universeId`.
 * Throws UnauthorizedError if not a member, ForbiddenError if a member
 * without sufficient permission. Intended for use in API route handlers.
 */
export async function assertCan(
  userId: string,
  universeId: string,
  action: Action
): Promise<MemberRole | 'ADMIN'> {
  const role = await getUniverseRole(userId, universeId);
  if (!role) {
    throw new UnauthorizedError(`Not a member of universe ${universeId}`);
  }
  if (role !== 'ADMIN' && !ROLE_PERMISSIONS[role].includes(action)) {
    throw new ForbiddenError(`Role ${role} cannot perform ${action}`);
  }
  return role;
}

/** Convenience list of permissions for a role, e.g. for client-side UI gating. */
export function permissionsFor(role: MemberRole | 'ADMIN' | null): Action[] {
  if (!role) return [];
  if (role === 'ADMIN') return ROLE_PERMISSIONS.OWNER;
  return ROLE_PERMISSIONS[role];
}
