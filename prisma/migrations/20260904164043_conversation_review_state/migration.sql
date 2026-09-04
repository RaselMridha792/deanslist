-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_reviewedAt_idx" ON "Conversation"("reviewedAt");
