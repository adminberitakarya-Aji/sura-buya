/**
 * VF-4.6 — Data Migration Script for VideoRender
 *
 * Migrates existing VideoRender records to new schema:
 * - parse resolution "1080x1920" → width=1080, height=1920
 * - platform single → platform array [single]
 * - fileSize → fileSizeBytes (BigInt)
 * - status default PENDING (kalau videoUrl ada → DONE)
 * - metadata: pindahkan timeline ke metadata.timeline
 * - buat 1 VideoRenderJob dengan attemptNumber=1, status=DONE (historical)
 */

import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from apps/web directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting VideoRender migration...');

  const renders = await prisma.videoRender.findMany({
    include: {
      project: true,
    },
  });

  console.log(`📊 Found ${renders.length} VideoRender records to migrate`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const render of renders) {
    try {
      // Check if already migrated (has width/height populated and platform is array)
      const isAlreadyMigrated = render.width > 0 && render.height > 0 && Array.isArray(render.platform);

      if (isAlreadyMigrated) {
        console.log(`⏭️  Skipping ${render.id} (already migrated)`);
        skipped++;
        continue;
      }

      // Parse resolution string (e.g., "1080x1920")
      let width = 1080;
      let height = 1920;
      if (render.resolution && render.resolution.includes('x')) {
        const [w, h] = render.resolution.split('x').map(Number);
        if (!isNaN(w) && !isNaN(h)) {
          width = w;
          height = h;
        }
      }

      // Convert platform to array
      const platformArray = Array.isArray(render.platform)
        ? render.platform
        : [render.platform];

      // Convert fileSize to fileSizeBytes (BigInt)
      let fileSizeBytes: bigint | null = null;
      if (render.fileSizeBytes !== null && render.fileSizeBytes !== undefined) {
        // If it's already a BigInt, keep it; otherwise convert from number
        fileSizeBytes = typeof render.fileSizeBytes === 'bigint'
          ? render.fileSizeBytes
          : BigInt(render.fileSizeBytes);
      }

      // Determine status: if videoUrl exists and not empty → DONE, else PENDING
      const status = render.videoUrl && render.videoUrl.length > 0 ? 'DONE' : 'PENDING';

      // Prepare metadata: move existing metadata to metadata.timeline if it exists
      const existingMetadata = (render.metadata as Record<string, unknown>) || {};
      const newMetadata = {
        ...existingMetadata,
        timeline: existingMetadata.timeline || existingMetadata,
      };

      // Update VideoRender record
      const updatedRender = await prisma.videoRender.update({
        where: { id: render.id },
        data: {
          width,
          height,
          platform: platformArray,
          fileSizeBytes,
          status: status as 'PENDING' | 'RENDERING' | 'DONE' | 'FAILED',
          metadata: newMetadata,
        },
      });

      // Create historical VideoRenderJob (attempt 1, DONE)
      await prisma.videoRenderJob.create({
        data: {
          renderId: render.id,
          attemptNumber: 1,
          providerUsed: 'remotion+ffmpeg',
          status: 'DONE',
          startedAt: render.createdAt,
          completedAt: render.updatedAt,
          cost: null,
          metadata: {
            migrated: true,
            originalResolution: render.resolution,
            originalPlatform: render.platform,
            migratedAt: new Date().toISOString(),
          },
        },
      });

      console.log(`✅ Migrated ${render.id} (${render.resolution} → ${width}x${height}, status: ${status})`);
      migrated++;

    } catch (error) {
      console.error(`❌ Error migrating ${render.id}:`, error);
      errors++;
    }
  }

  console.log('\n📈 Migration Summary:');
  console.log(`   ✅ Migrated: ${migrated}`);
  console.log(`   ⏭️  Skipped:  ${skipped}`);
  console.log(`   ❌ Errors:   ${errors}`);
  console.log(`   📊 Total:    ${renders.length}`);

  if (errors > 0) {
    console.log('\n⚠️  Some records failed to migrate. Check logs above.');
    process.exit(1);
  }

  console.log('\n🎉 Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('💥 Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });