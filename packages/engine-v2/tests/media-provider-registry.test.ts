import { describe, it, expect } from 'vitest';
import { MediaProviderRegistry } from '../src/ai/media-providers/registry.js';
import {
  MockImageProvider,
  MockVideoProvider,
  MockVoiceProvider,
} from '../src/ai/media-providers/mock-providers.js';
import { MediaChainExhaustedError } from '../src/ai/media-providers/types.js';

describe('MediaProviderRegistry', () => {
  describe('generateImage — fallback chain', () => {
    it('memakai provider pertama di chain kalau berhasil (tidak fallback)', async () => {
      const registry = new MediaProviderRegistry();
      registry.registerImageProvider(new MockImageProvider('nano-banana-2'));
      registry.registerImageProvider(new MockImageProvider('flux-2-pro'));
      registry.setImageChain(['nano-banana-2', 'flux-2-pro']);

      const { result, providerUsed, attempts } = await registry.generateImage({
        prompt: 'Kiko si kelinci melompat di kebun',
      });

      expect(providerUsed).toBe('nano-banana-2');
      expect(attempts).toEqual(['nano-banana-2']);
      expect(result.providerName).toBe('nano-banana-2');
    });

    it('fallback ke provider berikutnya kalau provider pertama gagal', async () => {
      const registry = new MediaProviderRegistry();
      registry.registerImageProvider(new MockImageProvider('nano-banana-2', { shouldFail: true })); // sengaja gagal
      registry.registerImageProvider(new MockImageProvider('flux-2-pro'));
      registry.setImageChain(['nano-banana-2', 'flux-2-pro']);

      const { providerUsed, attempts } = await registry.generateImage({
        prompt: 'Kiko si kelinci melompat di kebun',
      });

      expect(providerUsed).toBe('flux-2-pro');
      expect(attempts).toEqual(['nano-banana-2', 'flux-2-pro']); // keduanya tercatat dicoba
    });

    it('melempar MediaChainExhaustedError kalau SEMUA provider di chain gagal', async () => {
      const registry = new MediaProviderRegistry();
      registry.registerImageProvider(new MockImageProvider('nano-banana-2', { shouldFail: true }));
      registry.registerImageProvider(new MockImageProvider('flux-2-pro', { shouldFail: true }));
      registry.setImageChain(['nano-banana-2', 'flux-2-pro']);

      await expect(
        registry.generateImage({ prompt: 'Kiko si kelinci melompat di kebun' }),
      ).rejects.toThrow(MediaChainExhaustedError);
    });

    it('melempar error jelas kalau chain belum di-set', async () => {
      const registry = new MediaProviderRegistry();
      registry.registerImageProvider(new MockImageProvider('nano-banana-2'));
      // setImageChain() sengaja tidak dipanggil

      await expect(
        registry.generateImage({ prompt: 'Kiko si kelinci melompat di kebun' }),
      ).rejects.toThrow(/chain kosong/i);
    });

    it('skip provider yang belum terdaftar di chain tanpa menghentikan seluruh proses', async () => {
      const registry = new MediaProviderRegistry();
      registry.registerImageProvider(new MockImageProvider('flux-2-pro'));
      // 'nano-banana-2' ada di chain tapi TIDAK diregistrasi
      registry.setImageChain(['nano-banana-2', 'flux-2-pro']);

      const { providerUsed } = await registry.generateImage({
        prompt: 'Kiko si kelinci melompat di kebun',
      });

      expect(providerUsed).toBe('flux-2-pro');
    });

    it('membedakan dua failure mode: unavailable (skip tanpa generate) vs shouldFail (generate dipanggil lalu throw)', async () => {
      const registry = new MediaProviderRegistry();
      // unavailable: true -> isAvailable() false, generateImage() TIDAK PERNAH dipanggil
      registry.registerImageProvider(new MockImageProvider('nano-banana-2', { unavailable: true }));
      registry.registerImageProvider(new MockImageProvider('flux-2-pro'));
      registry.setImageChain(['nano-banana-2', 'flux-2-pro']);

      const { providerUsed, attempts } = await registry.generateImage({
        prompt: 'Kiko si kelinci melompat di kebun',
      });

      expect(providerUsed).toBe('flux-2-pro');
      // nano-banana-2 tetap tercatat "dicoba" (masuk attempts) walau isAvailable()-nya yang gagal, bukan generate()-nya
      expect(attempts).toEqual(['nano-banana-2', 'flux-2-pro']);
    });

    it('menerapkan latencyMs dari config (opt-in, default 0 supaya test lain tetap cepat)', async () => {
      const registry = new MediaProviderRegistry();
      registry.registerImageProvider(new MockImageProvider('nano-banana-2', { latencyMs: 30 }));
      registry.setImageChain(['nano-banana-2']);

      const start = Date.now();
      await registry.generateImage({ prompt: 'Kiko si kelinci melompat di kebun' });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(30);
    });

    it('memakai costUsd dari config kalau diisi, bukan default fixed value', async () => {
      const registry = new MediaProviderRegistry();
      registry.registerImageProvider(new MockImageProvider('nano-banana-2', { costUsd: 0.099 }));
      registry.setImageChain(['nano-banana-2']);

      const { result } = await registry.generateImage({ prompt: 'Kiko si kelinci melompat di kebun' });

      expect(result.cost).toBe(0.099);
    });
  });

  describe('generateVideoClip — fallback chain sesuai keputusan locked (Kling → Seedance → Wan)', () => {
    it('mensimulasikan chain 3-tingkat: primary gagal, fallback 1 gagal, fallback 2 berhasil', async () => {
      const registry = new MediaProviderRegistry();
      registry.registerVideoProvider(new MockVideoProvider('kling-3.0', { shouldFail: true }));
      registry.registerVideoProvider(new MockVideoProvider('seedance-2', { shouldFail: true }));
      registry.registerVideoProvider(new MockVideoProvider('wan-2.7'));
      registry.setVideoChain(['kling-3.0', 'seedance-2', 'wan-2.7']);

      const { providerUsed, attempts } = await registry.generateVideoClip({
        keyframeUrl: 'https://mock-media.local/image/nano-banana-2/kiko.png',
        duration: 5,
      });

      expect(providerUsed).toBe('wan-2.7');
      expect(attempts).toEqual(['kling-3.0', 'seedance-2', 'wan-2.7']);
    });
  });

  describe('synthesizeVoice', () => {
    it('berhasil sintesis suara dari voiceId yang dikonfigurasi per-karakter', async () => {
      const registry = new MediaProviderRegistry();
      registry.registerVoiceProvider(new MockVoiceProvider('elevenlabs'));
      registry.setVoiceChain(['elevenlabs']);

      const { result } = await registry.synthesizeVoice({
        text: 'Halo, aku Kiko!',
        voiceId: 'voice-kiko-001',
      });

      expect(result.providerName).toBe('elevenlabs');
      expect(result.url).toContain('voice-kiko-001');
    });
  });
});