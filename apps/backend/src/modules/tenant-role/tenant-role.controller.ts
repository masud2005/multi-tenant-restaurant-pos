import {
  Body,
  Controller,
  Delete,
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
import { TenantRoleService } from './tenant-role.service';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { CreateCustomRoleDto } from './dto/create-custom-role.dto';
import { UpdateCustomRoleDto } from './dto/update-custom-role.dto';

@ApiTags('(Tenant) Roles & Permissions')
@Controller('tenants')
export class TenantRoleController {
  constructor(private readonly tenantRoleService: TenantRoleService) {}

  @Get(':tenantSlug/roles')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ROLES_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all roles and permissions for a tenant',
    description:
      'Returns the full matrix of roles and their dynamic permissions for the specified restaurant tenant.',
  })
  @ApiResponse({
    status: 200,
    description: 'Roles and permissions retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async getTenantRoles(@Param('tenantSlug') tenantSlug: string) {
    const roles = await this.tenantRoleService.getTenantRoles(tenantSlug);
    return ResponseHelper.success(
      roles,
      'Roles and permissions retrieved successfully',
    );
  }

  @Put(':tenantSlug/roles/:role/permissions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update permissions for a specific role in a tenant',
    description:
      'Allows restaurant admin/owner to customize permissions (check/uncheck) for a role.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug',
  })
  @ApiParam({
    name: 'role',
    example: 'CASHIER',
    description: 'Role name (OWNER, MANAGER, CASHIER, KITCHEN, WAITER)',
  })
  @ApiResponse({
    status: 200,
    description: 'Role permissions updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid role or invalid permissions array',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  async updateRolePermissions(
    @Param('tenantSlug') tenantSlug: string,
    @Param('role') role: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    const updated = await this.tenantRoleService.updateRolePermissions(
      tenantSlug,
      role,
      dto,
    );
    return ResponseHelper.success(
      updated,
      `Permissions for role ${updated.role} updated successfully`,
    );
  }

  // ==================== Custom Roles Endpoints ====================

  @Get(':tenantSlug/custom-roles')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ROLES_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all custom roles for a tenant',
    description: 'Returns all user-defined custom roles with their permissions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Custom roles retrieved successfully',
  })
  async getCustomRoles(@Param('tenantSlug') tenantSlug: string) {
    const roles = await this.tenantRoleService.getCustomRoles(tenantSlug);
    return ResponseHelper.success(
      roles,
      'Custom roles retrieved successfully',
    );
  }

  @Post(':tenantSlug/custom-roles')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new custom role',
    description: 'Creates a custom role for the tenant with customized permissions.',
  })
  @ApiResponse({
    status: 201,
    description: 'Custom role created successfully',
  })
  async createCustomRole(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateCustomRoleDto,
  ) {
    const role = await this.tenantRoleService.createCustomRole(tenantSlug, dto);
    return ResponseHelper.success(
      role,
      `Custom role "${role.name}" created successfully`,
    );
  }

  @Get(':tenantSlug/custom-roles/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.ROLES_VIEW)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get custom role by ID',
    description: 'Fetches details of a specific custom role.',
  })
  async getCustomRoleById(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const role = await this.tenantRoleService.getCustomRoleById(tenantSlug, id);
    return ResponseHelper.success(
      role,
      'Custom role retrieved successfully',
    );
  }

  @Put(':tenantSlug/custom-roles/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update custom role (full)',
  })
  async updateCustomRolePut(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomRoleDto,
  ) {
    const role = await this.tenantRoleService.updateCustomRole(
      tenantSlug,
      id,
      dto,
    );
    return ResponseHelper.success(
      role,
      `Custom role "${role.name}" updated successfully`,
    );
  }

  @Patch(':tenantSlug/custom-roles/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update custom role (partial)',
  })
  async updateCustomRolePatch(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomRoleDto,
  ) {
    const role = await this.tenantRoleService.updateCustomRole(
      tenantSlug,
      id,
      dto,
    );
    return ResponseHelper.success(
      role,
      `Custom role "${role.name}" updated successfully`,
    );
  }

  @Put(':tenantSlug/custom-roles/:id/permissions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update permissions for a custom role',
  })
  async updateCustomRolePermissions(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
    @Body() dto: { permissions: string[] },
  ) {
    const role = await this.tenantRoleService.updateCustomRolePermissions(
      tenantSlug,
      id,
      dto.permissions || [],
    );
    return ResponseHelper.success(
      role,
      `Permissions for custom role "${role.name}" updated successfully`,
    );
  }

  @Delete(':tenantSlug/custom-roles/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a custom role',
  })
  async deleteCustomRole(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const result = await this.tenantRoleService.deleteCustomRole(
      tenantSlug,
      id,
    );
    return ResponseHelper.success(result, result.message);
  }
}
