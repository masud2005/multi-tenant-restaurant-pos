import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { TenantRoleModule } from './tenant-role/tenant-role.module';
import { StaffModule } from './staff/staff.module';
import { BranchModule } from './branch/branch.module';
import { CategoryModule } from './category/category.module';
import { ModifierGroupModule } from './modifier-group/modifier-group.module';
import { ComboModule } from './combo/combo.module';
import { MenuItemModule } from './menu-item/menu-item.module';
import { InventoryModule } from './inventory/inventory.module';
import { RecipeModule } from './recipe/recipe.module';
import { StockMovementModule } from './stock-movement/stock-movement.module';
import { TableModule } from './table/table.module';
import { OrderModule } from './order/order.module';
import { ReservationModule } from './reservation/reservation.module';
import { SupplierModule } from './supplier/supplier.module';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { GoodsReceiptModule } from './goods-receipt/goods-receipt.module';
import { SupplierReturnModule } from './supplier-return/supplier-return.module';
import { CustomerModule } from './customer/customer.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { FinanceModule } from './finance/finance.module';
import { PromotionModule } from './promotion/promotion.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditLogModule } from './audit-log/audit-log.module';

@Module({
  imports: [
    AuthModule,
    TenantRoleModule,
    StaffModule,
    BranchModule,
    CategoryModule,
    ModifierGroupModule,
    ComboModule,
    MenuItemModule,
    InventoryModule,
    RecipeModule,
    StockMovementModule,
    TableModule,
    OrderModule,
    ReservationModule,
    SupplierModule,
    PurchaseOrderModule,
    GoodsReceiptModule,
    SupplierReturnModule,
    CustomerModule,
    LoyaltyModule,
    FinanceModule,
    PromotionModule,
    NotificationsModule,
    AuditLogModule,
  ],
  exports: [
    TenantRoleModule,
    StaffModule,
    BranchModule,
    CategoryModule,
    ModifierGroupModule,
    ComboModule,
    MenuItemModule,
    InventoryModule,
    RecipeModule,
    StockMovementModule,
    TableModule,
    OrderModule,
    ReservationModule,
    SupplierModule,
    PurchaseOrderModule,
    GoodsReceiptModule,
    SupplierReturnModule,
    CustomerModule,
    LoyaltyModule,
    FinanceModule,
    PromotionModule,
    NotificationsModule,
    AuditLogModule,
  ],
})
export class ModulesModule {}
