/*
  Warnings:

  - You are about to drop the column `apiKeyRef` on the `AIConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AIConfig" DROP COLUMN "apiKeyRef",
ADD COLUMN     "apiKeyEncrypted" TEXT;
