import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';
import { parseFreeTextToPersona, PersonaParseError } from '@suro-buya/engine-v2';
import type { AIProvider, AIProviderOptions, AIResponse } from '@suro-buya/engine-v2';

const parsePersonaBodySchema = z.object({
  rawInput: z.string().min(10, 'Deskripsi terlalu pendek. Minimal 10 karakter.').max(5000),
  /**
   * Override `audienceProfile` dari konfigurasi universe. Jika tidak diisi,
   * endpoint akan mengambil nilai dari `Universe.audienceProfile` secara
   * otomatis — sehingga persona-parser.ts *selalu* mendapatkan konteks audiens
   * yang tepat tanpa memerlukan caller untuk mengetahui konfigurasi universe.
   */
  audienceProfileOverride: z.string().max(500).optional(),
});

interface RouteParams {
  params: { universeId: string };
}

/**
 * POST /api/universes/:universeId/characters/parse-persona
 *
 * Step 1 Opsi A — menerima free-text dari wizard UI, meneruskannya ke
 * `parseFreeTextToPersona()` beserta `audienceProfile` universe, dan
 * mengembalikan `PersonaDraft` yang siap ditampilkan di Step 2 (review).
 *
 * PENTING: endpoint ini TIDAK menyimpan apapun ke database. Hasilnya
 * dikembalikan ke client untuk di-review user di Step 2. Penyimpanan
 * permanen terjadi lewat POST /api/universes/:id/characters (existing route)
 * setelah user approve draft.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    // Perlu permission content:write karena endpoint ini bagian dari alur
    // pembuatan karakter (meski belum menulis ke DB, ia mengonsumsi AI quota).
    await assertCan(userId, params.universeId, 'content:write');

    const body = await req.json();
    const { rawInput, audienceProfileOverride } = parsePersonaBodySchema.parse(body);

    // Ambil konfigurasi universe untuk mendapatkan audienceProfile.
    // Endpoint ini wajib meneruskan audienceProfile ke parseFreeTextToPersona()
    // agar persona yang dihasilkan konsisten dengan target audiens universe
    // (mis. ALL_AGES → tidak ada elemen dewasa; MATURE → bisa berbeda nada).
    const universe = await prisma.universe.findUniqueOrThrow({
      where: { id: params.universeId },
      select: { audienceProfile: true, contentRating: true },
    });

    const audienceProfile = audienceProfileOverride ?? universe.audienceProfile ?? undefined;

    // Ambil AI provider dari konfigurasi universe (task CREATIVE_GENERATION).
    // Fallback ke mock provider jika belum dikonfigurasi (untuk dev/preview).
    const aiConfig = await prisma.aIConfig.findFirst({
      where: {
        universeId: params.universeId,
        task: 'CREATIVE_GENERATION',
        isDefault: true,
      },
      select: { provider: true, model: true, parameters: true, apiKeyEncrypted: true },
    });

    // Build AIProvider — menggunakan pola yang sama dengan route AI existing.
    // Jika tidak ada konfigurasi AI atau API key, gunakan mock provider
    // yang mengembalikan JSON minimal agar wizard tetap bisa didemonstrasikan
    // di lingkungan tanpa AI key.
    let apiKey: string | undefined;
    if (aiConfig?.apiKeyEncrypted) {
      try {
        const { decryptSecret } = await import('@/lib/encryption');
        apiKey = decryptSecret(aiConfig.apiKeyEncrypted);
      } catch {
        // Jika decryption gagal (mis. KEY rotasi), lanjut pakai mock
        apiKey = undefined;
      }
    }

    const provider = buildAIProvider(
      apiKey,
      aiConfig?.provider,
      aiConfig?.model,
      aiConfig?.parameters as Record<string, unknown> | null,
    );

    // Jalankan parsing — PersonaParseError dilempar kalau AI gagal
    // menghasilkan JSON valid atau validasi Zod PersonaDraft gagal.
    const draft = await parseFreeTextToPersona(rawInput, provider, audienceProfile);

    return NextResponse.json(
      {
        draft,
        meta: {
          contentRating: universe.contentRating,
          audienceProfile: audienceProfile ?? null,
          providerUsed: provider.name,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof PersonaParseError) {
      return NextResponse.json(
        { error: error.message, rawOutput: error.rawResponse ?? null },
        { status: 422 },
      );
    }
    return errorResponse(error);
  }
}

// ---------------------------------------------------------------------------
// Helper — membangun AIProvider dari konfigurasi yang tersimpan di DB,
// dengan fallback ke mock provider jika tidak ada key/konfigurasi.
// ---------------------------------------------------------------------------

function buildAIProvider(
  apiKey: string | undefined,
  providerName?: string,
  modelName?: string,
  parameters?: Record<string, unknown> | null,
): AIProvider {
  const name = providerName ?? 'mock-anthropic';
  const model = modelName ?? 'mock-model';

  if (!apiKey || apiKey.trim() === '') {
    // Mock provider — selalu mengembalikan JSON PersonaDraft kosong yang tetap
    // lulus validasi Zod sehingga wizard bisa didemonstrasikan tanpa API key.
    return {
      name: `mock-${name}`,
      version: '0.0.0',
      isAvailable: async () => true,
      getModels: async () => [model],
      generateStream: async function* () { yield ''; },
      generate: async (prompt: string, opts: AIProviderOptions): Promise<AIResponse> => {
        void prompt; void opts;
        return {
          content: JSON.stringify({
            name: 'karakter-draft',
            displayName: 'Karakter Draft (Mock)',
            role: 'SUPPORTING',
            species: 'Manusia',
            ageDescriptor: 'dewasa muda',
            description: 'Deskripsi singkat karakter ini. Harap isi AI provider key untuk mengaktifkan parsing nyata.',
            coreTraits: ['ramah', 'bijaksana'],
            coreWeakness: 'Mudah ragu dalam mengambil keputusan besar',
            voiceGuide: 'Suara tenang dan terukur, pilihan kata yang hati-hati',
            visualDescription: 'Penampilan rapi dengan warna netral, sorot mata penuh pertimbangan',
          }),
          model,
          provider: name,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          latency: 0,
          finishReason: 'stop',
        };
      },
    };
  }

  // Real provider — Anthropic Claude (pola sama persis dengan providers.ts existing di engine-v2)
  return {
    name: name,
    version: '1.0.0',
    isAvailable: async () => true,
    getModels: async () => [model],
    generateStream: async function* () { yield ''; },
    generate: async (prompt: string, opts: AIProviderOptions): Promise<AIResponse> => {
      const startMs = Date.now();
      const messages: { role: 'user' | 'assistant'; content: string }[] = [];
      if (opts.systemPrompt) {
        // Anthropic hanya menerima system di level top-level, bukan di messages
        // — dihandle via header terpisah di call di bawah
      }
      messages.push({ role: 'user', content: prompt });

      const requestBody: Record<string, unknown> = {
        model: opts.model ?? model,
        max_tokens: opts.maxTokens ?? 1024,
        messages,
      };
      if (opts.systemPrompt) {
        requestBody['system'] = opts.systemPrompt;
      }
      if (opts.temperature !== undefined) requestBody['temperature'] = opts.temperature;

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.statusText);
        throw new Error(`Anthropic API error ${resp.status}: ${errText}`);
      }

      const data = await resp.json() as {
        content: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
        stop_reason?: string;
      };

      const content = data.content?.find((c) => c.type === 'text')?.text ?? '';
      const usage = data.usage ?? {};

      return {
        content,
        model: opts.model ?? model,
        provider: name,
        usage: {
          promptTokens: usage.input_tokens ?? 0,
          completionTokens: usage.output_tokens ?? 0,
          totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
        },
        latency: Date.now() - startMs,
        finishReason: (
          ['stop', 'length', 'content_filter', 'error', 'unknown'].includes(data.stop_reason ?? '')
            ? data.stop_reason
            : 'stop'
        ) as AIResponse['finishReason'],
      };
    },
  };
}
