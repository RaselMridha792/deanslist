-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "promotionId" TEXT;

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "entryAskCity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "entryAskGroupSize" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "entryAskLink" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "entryAskPhone" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "entryBlurb" TEXT,
ADD COLUMN     "entryButtonLabel" TEXT,
ADD COLUMN     "entryEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "entryHeading" TEXT,
ADD COLUMN     "entryQuestion" TEXT;

-- AlterTable
ALTER TABLE "Show" ADD COLUMN     "liveUrl" TEXT;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
