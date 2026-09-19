-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "customerId" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "value" INTEGER,
    "note" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_businessId_stage_idx" ON "leads"("businessId", "stage");

-- CreateIndex
CREATE INDEX "leads_businessId_customerId_idx" ON "leads"("businessId", "customerId");
