import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptSecret, decryptSecret, maskSecret } from './encryption';

const TEST_KEY = Buffer.alloc(32, 7).toString('base64'); // deterministic 32-byte key

describe('encryption', () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  describe('encryptSecret / decryptSecret', () => {
    it('round-trips a plaintext value', () => {
      const plaintext = 'sk-ant-super-secret-api-key-12345';
      const encrypted = encryptSecret(plaintext);
      expect(decryptSecret(encrypted)).toBe(plaintext);
    });

    it('produces different ciphertext for the same plaintext each time (random IV)', () => {
      const a = encryptSecret('same-input');
      const b = encryptSecret('same-input');
      expect(a).not.toBe(b);
    });

    it('never leaks the plaintext inside the ciphertext string', () => {
      const plaintext = 'sk-ant-do-not-leak-this';
      const encrypted = encryptSecret(plaintext);
      expect(encrypted).not.toContain(plaintext);
    });

    it('throws when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encryptSecret('x')).toThrow(/ENCRYPTION_KEY is not set/);
    });

    it('throws when ENCRYPTION_KEY is not 32 bytes', () => {
      process.env.ENCRYPTION_KEY = Buffer.from('too-short').toString('base64');
      expect(() => encryptSecret('x')).toThrow(/32 bytes/);
    });

    it('throws on malformed ciphertext', () => {
      expect(() => decryptSecret('not-a-valid-format')).toThrow(/Malformed/);
    });

    it('throws when decrypting with a different key (tamper/auth check)', () => {
      const encrypted = encryptSecret('secret-value');
      process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
      expect(() => decryptSecret(encrypted)).toThrow();
    });
  });

  describe('maskSecret', () => {
    it('shows only the last 4 characters', () => {
      expect(maskSecret('sk-ant-1234567890abcd')).toBe('••••abcd');
    });

    it('fully masks very short secrets', () => {
      expect(maskSecret('ab')).toBe('••••');
    });
  });
});
