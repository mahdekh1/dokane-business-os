-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customerName" TEXT;

-- CreateIndex
CREATE INDEX "orders_businessId_customerId_idx" ON "orders"("businessId", "customerId");
