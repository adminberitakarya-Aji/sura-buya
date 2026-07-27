import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { requireUserId, unauthorized, errorResponse } from '@/lib/api-helpers';
import { decryptSecret, maskSecret } from '@/lib/encryption';

interface RouteParams {
  params: { universeId: string };
}

/**
 * GET /api/universes/:universeId/ai-config
 * Lists AI provider configuration per task. The API key is NEVER returned
 * in full — only a masked preview (e.g. "••••abcd") derived server-side,
 * and a boolean flag indicating whether a key is set at all.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    await assertCan(userId, params.universeId, 'ai-config:read');

    const configs = await prisma.aIConfig.findMany({
      where: { universeId: params.universeId },
      orderBy: { task: 'asc' },
    });

    return NextResponse.json({
      configs: configs.map((c: (typeof configs)[number]) => ({
        id: c.id,
        task: c.task,
        provider: c.provider,
        model: c.model,
        parameters: c.parameters,
        isDefault: c.isDefault,
        hasApiKey: Boolean(c.apiKeyEncrypted),
        apiKeyMasked: safeMask(c.apiKeyEncrypted),
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function safeMask(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    return maskSecret(decryptSecret(encrypted));
  } catch {
    // If decryption fails (e.g. ENCRYPTION_KEY rotated), don't crash the
    // whole list response — just signal a key is present but unreadable.
    return '••••';
  }
}
