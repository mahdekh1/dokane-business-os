-- CreateTable
CREATE TABLE "financial_entries" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "category" TEXT,
    "channelId" UUID,
    "method" TEXT,
    "sourceType" TEXT,
    "sourceId" UUID,
    "note" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_entries_businessId_type_entryDate_idx" ON "financial_entries"("businessId", "type", "entryDate");

-- CreateIndex
CREATE INDEX "financial_entries_businessId_channelId_idx" ON "financial_entries"("businessId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_entries_businessId_sourceId_key" ON "financial_entries"("businessId", "sourceId");
