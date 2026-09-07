-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'RUNNING', 'ENDED');

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kicker" TEXT,
    "tagline" TEXT,
    "summary" TEXT NOT NULL,
    "body" TEXT,
    "steps" TEXT,
    "prizeTitle" TEXT,
    "prizeNote" TEXT,
    "hashtags" TEXT,
    "imagePath" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
    "showId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_slug_key" ON "Promotion"("slug");

-- CreateIndex
CREATE INDEX "Promotion_status_idx" ON "Promotion"("status");

-- CreateIndex
CREATE INDEX "Promotion_slug_idx" ON "Promotion"("slug");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;
