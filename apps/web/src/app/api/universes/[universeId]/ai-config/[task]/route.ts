import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
// any was removed in Prisma 5.22.0
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';
import { encryptSecret, decryptSecret, maskSecret } from '@/lib/encryption';

const AI_TASKS = [
  'CREATIVE_GENERATION',
  'PLANNING',
  'VALIDATION',
  'EMBEDDING',
  'IMAGE_PROMPT',
  'CODE_GENERATION',
] as const;

const taskParamSchema = z.enum(AI_TASKS);

const upsertConfigSchema = z.object({
  provider: z.string().min(1).max(50),
  model: z.string().min(1).max(100),
  // Plaintext API key from the client. Omit to leave the stored key
  // untouched; pass an empty string to explicitly clear it.
  apiKey: z.string().max(500).optional(),
  parameters: z.record(z.unknown()).optional(),
  isDefault: z.boolean().optional(),
});

interface RouteParams {
  params: { universeId: string; task: string };
}

function toResponseShape(config: {
  id: string;
  task: string;
  provider: string;
  model: string;
  parameters: unknown;
  isDefault: boolean;
  apiKeyEncrypted: string | null;
  updatedAt: Date;
}) {
  let apiKeyMasked: string | null = null;
  if (config.apiKeyEncrypted) {
    try {
      apiKeyMasked = maskSecret(decryptSecret(config.apiKeyEncrypted));
    } catch {
      apiKeyMasked = '••••';
    }
  }
  return {
    id: config.id,
    task: config.task,
    provider: config.provider,
    model: config.model,
    parameters: config.parameters,
    isDefault: config.isDefault,
    hasApiKey: Boolean(config.apiKeyEncrypted),
    apiKeyMasked,
    updatedAt: config.updatedAt,
  };
}

/**
 * PUT /api/universes/:universeId/ai-config/:task
 * Upserts the provider configuration for a single AI task. The API key,
 * if provided, is encrypted before being persisted — the plaintext is
 * never stored or logged.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'ai-config:write');

    const task = taskParamSchema.parse(params.task);
    const body = await req.json();
    const data = upsertConfigSchema.parse(body);

    const encryptedKeyUpdate: { apiKeyEncrypted?: string | null } = {};
    if (data.apiKey !== undefined) {
      encryptedKeyUpdate.apiKeyEncrypted = data.apiKey === '' ? null : encryptSecret(data.apiKey);
    }

    const config = await prisma.aIConfig.upsert({
      where: { universeId_task: { universeId: params.universeId, task } },
      create: {
        universeId: params.universeId,
        task,
        provider: data.provider,
        model: data.model,
        isDefault: data.isDefault ?? false,
        ...(data.parameters !== undefined
          ? { parameters: data.parameters as any }
          : {}),
        ...encryptedKeyUpdate,
      },
      update: {
        provider: data.provider,
        model: data.model,
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        ...(data.parameters !== undefined
          ? { parameters: data.parameters as any }
          : {}),
        ...encryptedKeyUpdate,
      },
    });

    return NextResponse.json({ config: toResponseShape(config) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/universes/:universeId/ai-config/:task — revert to no override for this task. */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'ai-config:write');

    const task = taskParamSchema.parse(params.task);

    const existing = await prisma.aIConfig.findUnique({
      where: { universeId_task: { universeId: params.universeId, task } },
      select: { id: true },
    });

    if (existing) {
      await prisma.aIConfig.delete({ where: { id: existing.id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
