-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "locationId" UUID,
    "customerId" UUID,
    "entryMode" TEXT NOT NULL,
    "fulfillmentStatus" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "note" TEXT,
    "stockCommitted" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "offeringId" UUID,
    "variantId" UUID,
    "nameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_businessId_fulfillmentStatus_idx" ON "orders"("businessId", "fulfillmentStatus");

-- CreateIndex
CREATE INDEX "orders_businessId_channelId_idx" ON "orders"("businessId", "channelId");

-- CreateIndex
CREATE INDEX "orders_businessId_createdAt_idx" ON "orders"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_businessId_idempotencyKey_key" ON "orders"("businessId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "order_items_businessId_orderId_idx" ON "order_items"("businessId", "orderId");

-- CreateIndex
CREATE INDEX "payments_businessId_orderId_idx" ON "payments"("businessId", "orderId");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
