-- AlterTable
ALTER TABLE "Affiliate" ADD COLUMN     "payoutDetails" JSONB,
ADD COLUMN     "payoutMethod" TEXT NOT NULL DEFAULT 'paypal',
ADD COLUMN     "pendingPayout" JSONB,
ADD COLUMN     "pendingPayoutExpires" TIMESTAMP(3),
ADD COLUMN     "pendingPayoutTokenHash" TEXT;

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "scopes" TEXT[] DEFAULT ARRAY['full']::TEXT[];

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'run',
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "payTo" JSONB,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "runId" TEXT,
ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Referral" ADD COLUMN     "amountOriginal" DECIMAL(12,2),
ADD COLUMN     "fxDate" TIMESTAMP(3),
ADD COLUMN     "fxRate" DECIMAL(18,8),
ADD COLUMN     "fxSource" TEXT,
ADD COLUMN     "orderTotalOriginal" DECIMAL(12,2),
ADD COLUMN     "originalCurrency" TEXT,
ALTER COLUMN "currency" SET DEFAULT 'USD';

-- CreateTable
CREATE TABLE "PayoutRun" (
    "id" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "summary" JSONB NOT NULL,
    "paypalBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "rateDate" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FxRate_base_quote_day_key" ON "FxRate"("base", "quote", "day");

-- CreateIndex
CREATE INDEX "Payout_runId_idx" ON "Payout"("runId");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayoutRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

