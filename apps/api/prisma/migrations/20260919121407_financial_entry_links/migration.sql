-- AlterTable
ALTER TABLE "financial_entries" ADD COLUMN     "customerId" UUID,
ADD COLUMN     "orderId" UUID;

-- CreateIndex
CREATE INDEX "financial_entries_businessId_customerId_idx" ON "financial_entries"("businessId", "customerId");
