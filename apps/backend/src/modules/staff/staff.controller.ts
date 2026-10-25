import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('(Tenant) Staff')
@Controller('tenants')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post(':tenantSlug/staff')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add a new staff member to the restaurant',
    description: 'Creates a staff member in the restaurant directory with an assigned role.',
  })
  @ApiParam({ name: 'tenantSlug', example: 'sultans-dine', description: 'Restaurant slug' })
  @ApiResponse({ status: 201, description: 'Staff member created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async createStaff(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateStaffDto,
  ) {
    const staff = await this.staffService.createStaff(tenantSlug, dto);
    return ResponseHelper.created(staff, 'Staff member added successfully');
  }

  @Get(':tenantSlug/staff')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all staff members of the restaurant',
    description: 'Retrieves the full staff directory for the specified restaurant tenant.',
  })
  @ApiParam({ name: 'tenantSlug', example: 'sultans-dine', description: 'Restaurant slug' })
  @ApiResponse({ status: 200, description: 'Staff list retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async getStaffList(@Param('tenantSlug') tenantSlug: string) {
    const list = await this.staffService.getStaffList(tenantSlug);
    return ResponseHelper.success(list, 'Staff list retrieved successfully');
  }

  @Get(':tenantSlug/staff/:staffId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get details of a specific staff member' })
  @ApiParam({ name: 'tenantSlug', example: 'sultans-dine' })
  @ApiParam({ name: 'staffId', example: 'uuid-string' })
  @ApiResponse({ status: 200, description: 'Staff member retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async getStaffById(
    @Param('tenantSlug') tenantSlug: string,
    @Param('staffId') staffId: string,
  ) {
    const staff = await this.staffService.getStaffById(tenantSlug, staffId);
    return ResponseHelper.success(staff, 'Staff member retrieved successfully');
  }

  @Put(':tenantSlug/staff/:staffId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update staff member information or role' })
  @ApiParam({ name: 'tenantSlug', example: 'sultans-dine' })
  @ApiParam({ name: 'staffId', example: 'uuid-string' })
  @ApiResponse({ status: 200, description: 'Staff member updated successfully' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async updateStaff(
    @Param('tenantSlug') tenantSlug: string,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    const updated = await this.staffService.updateStaff(
      tenantSlug,
      staffId,
      dto,
    );
    return ResponseHelper.success(updated, 'Staff member updated successfully');
  }

  @Delete(':tenantSlug/staff/:staffId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a staff member from the restaurant' })
  @ApiParam({ name: 'tenantSlug', example: 'sultans-dine' })
  @ApiParam({ name: 'staffId', example: 'uuid-string' })
  @ApiResponse({ status: 200, description: 'Staff member removed successfully' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async deleteStaff(
    @Param('tenantSlug') tenantSlug: string,
    @Param('staffId') staffId: string,
  ) {
    const result = await this.staffService.deleteStaff(tenantSlug, staffId);
    return ResponseHelper.success(result, 'Staff member removed successfully');
  }

  @Post(':tenantSlug/staff/:staffId/invite')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send or resend an invitation link to a staff member' })
  @ApiParam({ name: 'tenantSlug', example: 'sultans-dine' })
  @ApiParam({ name: 'staffId', example: 'uuid-string' })
  @ApiResponse({ status: 200, description: 'Invitation sent successfully' })
  async reinviteStaff(
    @Param('tenantSlug') tenantSlug: string,
    @Param('staffId') staffId: string,
  ) {
    const result = await this.staffService.reinviteStaff(tenantSlug, staffId);
    return ResponseHelper.success(result, result.message);
  }
}
