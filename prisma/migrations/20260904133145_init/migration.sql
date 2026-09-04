-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'EDITOR', 'REVIEWER');

-- CreateEnum
CREATE TYPE "ShowStatus" AS ENUM ('DRAFT', 'OPEN', 'LIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LeadType" AS ENUM ('CONTESTANT', 'FAN', 'SPONSOR', 'CREW', 'GENERAL', 'PRESS');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'REVIEWED', 'SHORTLISTED', 'FINALIST', 'REJECTED', 'CONTACTED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE_FORM', 'CHATBOT', 'NEWSLETTER', 'IMPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "SendStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BOUNCED', 'OPENED', 'CLICKED');

-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM ('DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'DELIVERY_DELAYED');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('UNSUBSCRIBED', 'HARD_BOUNCE', 'COMPLAINT', 'MANUAL');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Show" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "prizeAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "entryDeadline" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "status" "ShowStatus" NOT NULL DEFAULT 'DRAFT',
    "heroImageUrl" TEXT,
    "trailerUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Show_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "episodeNo" INTEGER,
    "airedAt" TIMESTAMP(3),
    "videoUrl" TEXT,
    "thumbnail" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Winner" (
    "id" TEXT NOT NULL,
    "showId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "prizeAwarded" INTEGER,
    "photoUrl" TEXT,
    "videoUrl" TEXT,
    "story" TEXT,
    "announcedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Winner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "type" "LeadType" NOT NULL DEFAULT 'GENERAL',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" "LeadSource" NOT NULL DEFAULT 'WEBSITE_FORM',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "city" TEXT,
    "talentCategory" TEXT,
    "performanceUrl" TEXT,
    "stageName" TEXT,
    "ageRange" TEXT,
    "message" TEXT,
    "meta" JSONB,
    "showId" TEXT,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "internalNotes" TEXT,
    "unsubscribeToken" TEXT,
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagOnLead" (
    "leadId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "TagOnLead_pkey" PRIMARY KEY ("leadId","tagId")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "bodyHtml" TEXT NOT NULL,
    "templateKey" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "showId" TEXT,
    "segmentId" TEXT,
    "audience" JSONB,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalOpened" INTEGER NOT NULL DEFAULT 0,
    "totalClicked" INTEGER NOT NULL DEFAULT 0,
    "totalBounced" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSend" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "SendStatus" NOT NULL DEFAULT 'QUEUED',
    "providerId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CampaignSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "leadId" TEXT,
    "intent" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "handedOff" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteStat" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "prefix" TEXT,
    "suffix" TEXT,
    "displayAs" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "url" TEXT,
    "tier" TEXT,
    "blurb" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryImage" (
    "id" TEXT NOT NULL,
    "showId" TEXT,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "caption" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageSection" (
    "id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "heading" TEXT,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filter" JSONB NOT NULL,
    "lastCount" INTEGER,
    "lastCountAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "type" "EmailEventType" NOT NULL,
    "email" TEXT NOT NULL,
    "providerId" TEXT,
    "sendId" TEXT,
    "url" TEXT,
    "reason" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Show_slug_key" ON "Show"("slug");

-- CreateIndex
CREATE INDEX "Show_status_idx" ON "Show"("status");

-- CreateIndex
CREATE INDEX "Show_slug_idx" ON "Show"("slug");

-- CreateIndex
CREATE INDEX "Episode_showId_idx" ON "Episode"("showId");

-- CreateIndex
CREATE UNIQUE INDEX "Winner_slug_key" ON "Winner"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_unsubscribeToken_key" ON "Lead"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "Lead_type_status_idx" ON "Lead"("type", "status");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_country_idx" ON "Lead"("country");

-- CreateIndex
CREATE INDEX "Lead_showId_idx" ON "Lead"("showId");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE INDEX "Lead_marketingOptIn_idx" ON "Lead"("marketingOptIn");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_scheduledFor_idx" ON "Campaign"("scheduledFor");

-- CreateIndex
CREATE INDEX "CampaignSend_status_idx" ON "CampaignSend"("status");

-- CreateIndex
CREATE INDEX "CampaignSend_campaignId_status_idx" ON "CampaignSend"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSend_campaignId_leadId_key" ON "CampaignSend"("campaignId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_sessionId_key" ON "Conversation"("sessionId");

-- CreateIndex
CREATE INDEX "Conversation_leadId_idx" ON "Conversation"("leadId");

-- CreateIndex
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteStat_key_key" ON "SiteStat"("key");

-- CreateIndex
CREATE INDEX "SiteStat_active_sortOrder_idx" ON "SiteStat"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Sponsor_slug_key" ON "Sponsor"("slug");

-- CreateIndex
CREATE INDEX "Sponsor_active_sortOrder_idx" ON "Sponsor"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "GalleryImage_showId_sortOrder_idx" ON "GalleryImage"("showId", "sortOrder");

-- CreateIndex
CREATE INDEX "PageSection_page_published_sortOrder_idx" ON "PageSection"("page", "published", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PageSection_page_key_key" ON "PageSection"("page", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Segment_name_key" ON "Segment"("name");

-- CreateIndex
CREATE INDEX "EmailEvent_email_idx" ON "EmailEvent"("email");

-- CreateIndex
CREATE INDEX "EmailEvent_type_createdAt_idx" ON "EmailEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "EmailEvent_sendId_idx" ON "EmailEvent"("sendId");

-- CreateIndex
CREATE UNIQUE INDEX "Suppression_email_key" ON "Suppression"("email");

-- CreateIndex
CREATE INDEX "Suppression_reason_idx" ON "Suppression"("reason");

-- CreateIndex
CREATE INDEX "Job_status_runAfter_idx" ON "Job"("status", "runAfter");

-- CreateIndex
CREATE INDEX "Job_kind_idx" ON "Job"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_key_key" ON "Asset"("key");

-- CreateIndex
CREATE INDEX "Asset_leadId_idx" ON "Asset"("leadId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userEmail_createdAt_idx" ON "AuditLog"("userEmail", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagOnLead" ADD CONSTRAINT "TagOnLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagOnLead" ADD CONSTRAINT "TagOnLead_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSend" ADD CONSTRAINT "CampaignSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSend" ADD CONSTRAINT "CampaignSend_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_sendId_fkey" FOREIGN KEY ("sendId") REFERENCES "CampaignSend"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
