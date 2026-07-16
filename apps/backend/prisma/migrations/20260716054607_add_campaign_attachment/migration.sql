-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "attachmentData" BYTEA,
ADD COLUMN     "attachmentFilename" TEXT,
ADD COLUMN     "attachmentMimeType" TEXT;
