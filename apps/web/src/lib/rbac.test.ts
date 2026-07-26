import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUniqueUser = vi.fn();
const findUniqueMembership = vi.fn();

vi.mock('./prisma', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => findUniqueUser(...args) },
    universeMember: {
      findUnique: (...args: unknown[]) => findUniqueMembership(...args),
    },
  },
}));

import { can, assertCan, getUniverseRole, permissionsFor, ForbiddenError, UnauthorizedError } from './rbac';

describe('rbac', () => {
  beforeEach(() => {
    findUniqueUser.mockReset();
    findUniqueMembership.mockReset();
  });

  describe('getUniverseRole', () => {
    it('returns ADMIN for global admin users regardless of membership', async () => {
      findUniqueUser.mockResolvedValue({ role: 'ADMIN' });
      const role = await getUniverseRole('user-1', 'universe-1');
      expect(role).toBe('ADMIN');
      expect(findUniqueMembership).not.toHaveBeenCalled();
    });

    it('returns the membership role for non-admin members', async () => {
      findUniqueUser.mockResolvedValue({ role: 'USER' });
      findUniqueMembership.mockResolvedValue({ role: 'EDITOR' });
      const role = await getUniverseRole('user-1', 'universe-1');
      expect(role).toBe('EDITOR');
    });

    it('returns null for non-members', async () => {
      findUniqueUser.mockResolvedValue({ role: 'USER' });
      findUniqueMembership.mockResolvedValue(null);
      const role = await getUniverseRole('user-1', 'universe-1');
      expect(role).toBeNull();
    });
  });

  describe('can', () => {
    it('allows OWNER to do everything', async () => {
      findUniqueUser.mockResolvedValue({ role: 'USER' });
      findUniqueMembership.mockResolvedValue({ role: 'OWNER' });
      expect(await can('u', 'w', 'universe:delete')).toBe(true);
      expect(await can('u', 'w', 'ai-config:write')).toBe(true);
    });

    it('denies VIEWER write actions', async () => {
      findUniqueUser.mockResolvedValue({ role: 'USER' });
      findUniqueMembership.mockResolvedValue({ role: 'VIEWER' });
      expect(await can('u', 'w', 'content:write')).toBe(false);
      expect(await can('u', 'w', 'content:read')).toBe(true);
    });

    it('allows REVIEWER to write reviews but not content', async () => {
      findUniqueUser.mockResolvedValue({ role: 'USER' });
      findUniqueMembership.mockResolvedValue({ role: 'REVIEWER' });
      expect(await can('u', 'w', 'review:write')).toBe(true);
      expect(await can('u', 'w', 'content:write')).toBe(false);
    });

    it('denies non-members entirely', async () => {
      findUniqueUser.mockResolvedValue({ role: 'USER' });
      findUniqueMembership.mockResolvedValue(null);
      expect(await can('u', 'w', 'content:read')).toBe(false);
    });
  });

  describe('assertCan', () => {
    it('throws UnauthorizedError for non-members', async () => {
      findUniqueUser.mockResolvedValue({ role: 'USER' });
      findUniqueMembership.mockResolvedValue(null);
      await expect(assertCan('u', 'w', 'content:read')).rejects.toBeInstanceOf(
        UnauthorizedError
      );
    });

    it('throws ForbiddenError for members lacking permission', async () => {
      findUniqueUser.mockResolvedValue({ role: 'USER' });
      findUniqueMembership.mockResolvedValue({ role: 'VIEWER' });
      await expect(assertCan('u', 'w', 'content:write')).rejects.toBeInstanceOf(
        ForbiddenError
      );
    });

    it('resolves with the role when permitted', async () => {
      findUniqueUser.mockResolvedValue({ role: 'USER' });
      findUniqueMembership.mockResolvedValue({ role: 'EDITOR' });
      await expect(assertCan('u', 'w', 'content:write')).resolves.toBe('EDITOR');
    });
  });

  describe('permissionsFor', () => {
    it('returns empty array for null role', () => {
      expect(permissionsFor(null)).toEqual([]);
    });

    it('returns OWNER-level permissions for ADMIN', () => {
      expect(permissionsFor('ADMIN')).toContain('universe:delete');
    });

    it('returns scoped permissions for VIEWER', () => {
      const perms = permissionsFor('VIEWER');
      expect(perms).toContain('content:read');
      expect(perms).not.toContain('content:write');
    });
  });
});
