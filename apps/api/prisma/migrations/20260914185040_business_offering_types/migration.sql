-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "offeringTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
