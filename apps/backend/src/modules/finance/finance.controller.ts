import {
  Controller,
  Get,
  Param,
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
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('(Tenant) Finance & Payments')
@Controller('tenants')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get(':tenantSlug/finance/ledger')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.PAYMENTS_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get restaurant payments and refunds ledger',
    description:
      'Retrieves the chronological transaction ledger of all payments and refunds recorded for the restaurant or specific branch, with daily totals and method breakdown.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'saffron-ember',
    description: 'Restaurant slug',
  })
  @ApiResponse({
    status: 200,
    description: 'Payments ledger retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async getLedger(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetLedgerQueryDto,
  ) {
    const data = await this.financeService.getLedger(tenantSlug, query);
    return ResponseHelper.success(data, 'Payments ledger retrieved successfully');
  }
}
