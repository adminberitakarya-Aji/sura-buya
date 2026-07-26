import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const findUniqueMock = vi.fn();
const createMock = vi.fn();
const hashPasswordMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  hashPassword: (...args: unknown[]) => hashPasswordMock(...args),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { POST } from './route';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const validInput = { name: 'Mas Aji', email: 'aji@example.com', password: 'password123' };

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    createMock.mockReset();
    hashPasswordMock.mockReset();
    hashPasswordMock.mockResolvedValue('hashed-password');
  });

  it('rejects invalid email', async () => {
    const res = await POST(makeRequest({ ...validInput, email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('rejects password shorter than 8 characters', async () => {
    const res = await POST(makeRequest({ ...validInput, password: 'short' }));
    expect(res.status).toBe(400);
  });

  it('returns 409 when email already registered', async () => {
    findUniqueMock.mockResolvedValue({ id: 'u1', email: validInput.email });
    const res = await POST(makeRequest(validInput));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toMatch(/sudah terdaftar/);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('creates the user with a hashed password and returns 201', async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: 'u1', email: validInput.email, name: validInput.name });

    const res = await POST(makeRequest(validInput));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.user.email).toBe(validInput.email);
    expect(hashPasswordMock).toHaveBeenCalledWith('password123');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: 'hashed-password' }),
      })
    );
    // Never leak the password hash back to the client.
    expect(json.user.passwordHash).toBeUndefined();
  });
});
