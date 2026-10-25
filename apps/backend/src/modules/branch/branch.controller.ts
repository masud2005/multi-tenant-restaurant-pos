import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('(Tenant) Branches')
@Controller('tenants')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Post(':tenantSlug/branches')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.BRANCHES_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new branch for the restaurant',
    description: 'Creates a physical branch/location under the restaurant tenant.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiResponse({
    status: 201,
    description: 'Branch created successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  @ApiResponse({ status: 409, description: 'Branch with this name already exists' })
  async createBranch(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateBranchDto,
  ) {
    const branch = await this.branchService.createBranch(tenantSlug, dto);
    return ResponseHelper.created(branch, 'Branch created successfully');
  }

  @Get(':tenantSlug/branches')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all branches of the restaurant',
    description: 'Retrieves all physical branches/locations for the specified restaurant tenant.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiResponse({
    status: 200,
    description: 'Branches retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async getAllBranches(@Param('tenantSlug') tenantSlug: string) {
    const branches = await this.branchService.getAllBranches(tenantSlug);
    return ResponseHelper.success(branches, 'Branches retrieved successfully');
  }

  @Get(':tenantSlug/branches/:branchId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.BRANCHES_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get details of a specific branch',
    description: 'Retrieves branch information by ID for the specified restaurant tenant.',
  })
  @ApiParam({ name: 'tenantSlug', example: 'sultans-dine', description: 'Restaurant slug' })
  @ApiParam({ name: 'branchId', example: 'uuid', description: 'Branch ID' })
  @ApiResponse({ status: 200, description: 'Branch retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Branch or restaurant not found' })
  async getBranchById(
    @Param('tenantSlug') tenantSlug: string,
    @Param('branchId') branchId: string,
  ) {
    const branch = await this.branchService.getBranchById(tenantSlug, branchId);
    return ResponseHelper.success(branch, 'Branch retrieved successfully');
  }

  @Put(':tenantSlug/branches/:branchId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.BRANCHES_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update branch information or active status',
    description: 'Updates branch details (name, address, phone, isActive) without removing historical records.',
  })
  @ApiParam({ name: 'tenantSlug', example: 'sultans-dine', description: 'Restaurant slug' })
  @ApiParam({ name: 'branchId', example: 'uuid', description: 'Branch ID' })
  @ApiResponse({ status: 200, description: 'Branch updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Branch or restaurant not found' })
  @ApiResponse({ status: 409, description: 'A branch with this name already exists' })
  async updateBranch(
    @Param('tenantSlug') tenantSlug: string,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchDto,
  ) {
    const branch = await this.branchService.updateBranch(tenantSlug, branchId, dto);
    return ResponseHelper.success(branch, 'Branch updated successfully');
  }

  @Patch(':tenantSlug/branches/:branchId/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.BRANCHES_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Toggle branch active/inactive status',
    description: 'Toggles branch between active and inactive. Does not delete historical orders or sales data.',
  })
  @ApiParam({ name: 'tenantSlug', example: 'sultans-dine', description: 'Restaurant slug' })
  @ApiParam({ name: 'branchId', example: 'uuid', description: 'Branch ID' })
  @ApiResponse({ status: 200, description: 'Branch status updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Branch or restaurant not found' })
  async toggleBranchStatus(
    @Param('tenantSlug') tenantSlug: string,
    @Param('branchId') branchId: string,
  ) {
    const branch = await this.branchService.toggleBranchStatus(tenantSlug, branchId);
    return ResponseHelper.success(branch, 'Branch status updated successfully');
  }
}
