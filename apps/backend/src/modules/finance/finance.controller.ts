import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { GetLedgerQueryDto } from './dto/get-ledger-query.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
import { AddCashEntryDto } from './dto/add-cash-entry.dto';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { GetCashSessionsQueryDto } from './dto/get-cash-sessions-query.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { GetExpensesQueryDto } from './dto/get-expenses-query.dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('(Tenant) Finance, Cash Drawer & Expenses')
@Controller('tenants')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // -------------------------------------------------------------------------
  // PAYMENTS & REFUNDS LEDGER
  // -------------------------------------------------------------------------

  @Get(':tenantSlug/finance/ledger')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PAYMENTS_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get restaurant payments and refunds ledger',
    description:
      'Retrieves the chronological transaction ledger of all payments and refunds recorded for the restaurant or specific branch, with daily totals and method breakdown.',
  })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember', description: 'Restaurant slug' })
  @ApiResponse({ status: 200, description: 'Payments ledger retrieved successfully' })
  async getLedger(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetLedgerQueryDto,
  ) {
    const data = await this.financeService.getLedger(tenantSlug, query);
    return ResponseHelper.success(data, 'Payments ledger retrieved successfully');
  }

  // -------------------------------------------------------------------------
  // CASH DRAWER & SHIFT SESSIONS
  // -------------------------------------------------------------------------

  @Get(':tenantSlug/cash-drawer/sessions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CASH_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List cash drawer sessions for restaurant / branch',
    description: 'Retrieves all historical and open cash drawer shifts with computed cash sales, refunds, expenses, and expected cash.',
  })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  async listCashSessions(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetCashSessionsQueryDto,
  ) {
    const data = await this.financeService.listCashSessions(tenantSlug, query);
    return ResponseHelper.success(data, 'Cash sessions retrieved successfully');
  }

  @Get(':tenantSlug/cash-drawer/current')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CASH_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current active open cash drawer session for branch',
  })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  async getCurrentCashSession(
    @Param('tenantSlug') tenantSlug: string,
    @Query('branchId') branchId: string,
  ) {
    const data = await this.financeService.getCurrentCashSession(tenantSlug, branchId);
    return ResponseHelper.success(data, 'Current cash session retrieved');
  }

  @Post(':tenantSlug/cash-drawer/sessions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CASH_MANAGE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Open a new cash drawer shift with float' })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  async openCashSession(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: OpenCashSessionDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.financeService.openCashSession(tenantSlug, dto, user);
    return ResponseHelper.success(data, 'Cash drawer opened successfully');
  }

  @Post(':tenantSlug/cash-drawer/sessions/:sessionId/entries')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CASH_MANAGE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record pay-in or pay-out entry in active cash drawer' })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  @ApiParam({ name: 'sessionId', example: 'session-uuid' })
  async addCashEntry(
    @Param('tenantSlug') tenantSlug: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: AddCashEntryDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.financeService.addCashEntry(tenantSlug, sessionId, dto, user);
    return ResponseHelper.success(data, 'Cash entry recorded successfully');
  }

  @Post(':tenantSlug/cash-drawer/sessions/:sessionId/close')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CASH_MANAGE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close cash drawer shift with counted cash reconciliation' })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  @ApiParam({ name: 'sessionId', example: 'session-uuid' })
  async closeCashSession(
    @Param('tenantSlug') tenantSlug: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: CloseCashSessionDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.financeService.closeCashSession(tenantSlug, sessionId, dto, user);
    return ResponseHelper.success(data, 'Cash drawer shift closed successfully');
  }

  // -------------------------------------------------------------------------
  // EXPENSES & PETTY CASH
  // -------------------------------------------------------------------------

  @Get(':tenantSlug/expenses')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.EXPENSES_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List restaurant branch running expenses' })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  async listExpenses(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetExpensesQueryDto,
  ) {
    const data = await this.financeService.listExpenses(tenantSlug, query);
    return ResponseHelper.success(data, 'Expenses retrieved successfully');
  }

  @Post(':tenantSlug/expenses')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.EXPENSES_MANAGE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a new branch expense' })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  async createExpense(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.financeService.createExpense(tenantSlug, dto, user);
    return ResponseHelper.success(data, 'Expense recorded successfully');
  }

  @Delete(':tenantSlug/expenses/:expenseId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.EXPENSES_MANAGE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an expense record' })
  @ApiParam({ name: 'tenantSlug', example: 'saffron-ember' })
  @ApiParam({ name: 'expenseId', example: 'expense-uuid' })
  async deleteExpense(
    @Param('tenantSlug') tenantSlug: string,
    @Param('expenseId') expenseId: string,
  ) {
    const data = await this.financeService.deleteExpense(tenantSlug, expenseId);
    return ResponseHelper.success(data, 'Expense deleted successfully');
  }
}
