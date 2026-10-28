-- AlterTable
ALTER TABLE "Affiliate" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];

