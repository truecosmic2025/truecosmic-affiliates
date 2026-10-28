-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "coach" TEXT;

-- CreateTable
CREATE TABLE "CoachDeal" (
    "id" TEXT NOT NULL,
    "coach" TEXT NOT NULL,
    "rateType" "RateType" NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachDeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoachDeal_coach_key" ON "CoachDeal"("coach");

