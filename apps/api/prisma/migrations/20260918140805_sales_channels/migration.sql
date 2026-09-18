-- CreateTable
CREATE TABLE "sales_channels" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationId" UUID,
    "fulfillmentLocationId" UUID,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_channels_businessId_idx" ON "sales_channels"("businessId");
