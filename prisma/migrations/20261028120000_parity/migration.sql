-- DropIndex
DROP INDEX "Referral_orderId_key";

-- AlterTable
ALTER TABLE "Affiliate" ADD COLUMN     "dynamicCoupon" TEXT,
ADD COLUMN     "emailOnReferral" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "registration" JSONB,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "signupIpHash" TEXT;

-- AlterTable
ALTER TABLE "Creative" ADD COLUMN     "groupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'image';

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Referral" ADD COLUMN     "campaign" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "flagged" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "parentReferralId" TEXT,
ADD COLUMN     "tierLevel" INTEGER,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'sale';

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "flagged" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'link';

-- CreateTable
CREATE TABLE "AffiliateGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rateType" "RateType",
    "rate" DECIMAL(10,2),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateProductRate" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rateType" "RateType" NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "AffiliateProductRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryRate" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rateType" "RateType" NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "CategoryRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateTier" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "threshold" DECIMAL(12,2) NOT NULL,
    "rateType" "RateType" NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "RateTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "affiliateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectLink" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bonus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "threshold" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonusAward" (
    "id" TEXT NOT NULL,
    "bonusId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonusAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateGroup_name_key" ON "AffiliateGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProductRate_affiliateId_productId_key" ON "AffiliateProductRate"("affiliateId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryRate_category_key" ON "CategoryRate"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_path_key" ON "LandingPage"("path");

-- CreateIndex
CREATE UNIQUE INDEX "DirectLink_domain_key" ON "DirectLink"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "BonusAward_bonusId_affiliateId_key" ON "BonusAward"("bonusId", "affiliateId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "Referral_createdAt_idx" ON "Referral"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_orderId_affiliateId_type_key" ON "Referral"("orderId", "affiliateId", "type");

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AffiliateGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_parentReferralId_fkey" FOREIGN KEY ("parentReferralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateProductRate" ADD CONSTRAINT "AffiliateProductRate_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateProductRate" ADD CONSTRAINT "AffiliateProductRate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectLink" ADD CONSTRAINT "DirectLink_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusAward" ADD CONSTRAINT "BonusAward_bonusId_fkey" FOREIGN KEY ("bonusId") REFERENCES "Bonus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusAward" ADD CONSTRAINT "BonusAward_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

