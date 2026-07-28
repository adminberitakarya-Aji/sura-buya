import { prisma } from '@/lib/prisma';

/**
 * Record a snapshot of a scene's content at a specific version number.
 * Called whenever `Scene.generatedText` changes and `version` is bumped, so
 * the Review Package UI can diff any two versions later. Idempotent: if a
 * snapshot for this (sceneId, version) already exists, it's left alone.
 */
export async function snapshotSceneVersion(
  sceneId: string,
  version: number,
  content: string
): Promise<void> {
  await prisma.sceneVersion.upsert({
    where: { sceneId_version: { sceneId, version } },
    update: {},
    create: { sceneId, version, content },
  });
}
