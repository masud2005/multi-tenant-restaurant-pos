-- AlterEnum
ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'PARTIALLY_RECEIVED';

-- DropForeignKey
ALTER TABLE "purchase_order_lines" DROP CONSTRAINT IF EXISTS "purchase_order_lines_ingredientId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_order_lines" DROP CONSTRAINT IF EXISTS "purchase_order_lines_purchaseOrderId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_tenantId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "purchase_orders_branchId_number_key";

-- AlterTable
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "createdBy",
DROP COLUMN IF EXISTS "expectedDate",
DROP COLUMN IF EXISTS "number",
DROP COLUMN IF EXISTS "sentAt",
DROP COLUMN IF EXISTS "tenantId",
DROP COLUMN IF EXISTS "total",
ADD COLUMN "createdById" TEXT NOT NULL,
ADD COLUMN "expectedAt" TIMESTAMP(3),
ADD COLUMN "poNumber" TEXT NOT NULL,
ADD COLUMN "restaurantId" TEXT NOT NULL,
ALTER COLUMN "notes" DROP DEFAULT;

-- DropTable
DROP TABLE IF EXISTS "purchase_order_lines";

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "receivedQty" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_orders_restaurantId_branchId_status_idx" ON "purchase_orders"("restaurantId", "branchId", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_restaurantId_poNumber_key" ON "purchase_orders"("restaurantId", "poNumber");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
