import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { RiderService } from './rider.service';
import { CreateRiderDto, UpdateRiderDto, GetRidersQueryDto } from './dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('(Tenant) Delivery & Riders')
@Controller('tenants')
export class RiderController {
  constructor(private readonly riderService: RiderService) {}

  @Post(':tenantSlug/riders')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DELIVERY_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new delivery rider',
    description: 'Registers a new rider assigned to a restaurant branch for order dispatching.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug or ID',
  })
  @ApiResponse({
    status: 201,
    description: 'Rider created successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Restaurant or branch not found' })
  async createRider(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateRiderDto,
  ) {
    const rider = await this.riderService.createRider(tenantSlug, dto);
    return ResponseHelper.created(
      rider,
      `Rider ${rider.name} registered successfully`,
    );
  }

  @Get(':tenantSlug/riders')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DELIVERY_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all delivery riders',
    description: 'Returns list of delivery riders optionally filtered by branch, active status, or search term.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug or ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Riders retrieved successfully',
  })
  async getRiders(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetRidersQueryDto,
  ) {
    const riders = await this.riderService.getRiders(tenantSlug, query);
    return ResponseHelper.success(riders, 'Riders retrieved successfully');
  }

  @Get(':tenantSlug/riders/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DELIVERY_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get rider details by ID',
    description: 'Returns profile details for a specific delivery rider.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug or ID',
  })
  @ApiParam({
    name: 'id',
    example: 'uuid',
    description: 'Rider ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Rider retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Rider not found' })
  async getRiderById(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const rider = await this.riderService.getRiderById(tenantSlug, id);
    return ResponseHelper.success(rider, 'Rider retrieved successfully');
  }

  @Patch(':tenantSlug/riders/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DELIVERY_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update rider details',
    description: 'Updates rider name, phone, branch assignment, or active availability.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug or ID',
  })
  @ApiParam({
    name: 'id',
    example: 'uuid',
    description: 'Rider ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Rider updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Rider not found' })
  async updateRider(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
    @Body() dto: UpdateRiderDto,
  ) {
    const rider = await this.riderService.updateRider(tenantSlug, id, dto);
    return ResponseHelper.success(
      rider,
      `Rider ${rider.name} updated successfully`,
    );
  }

  @Delete(':tenantSlug/riders/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DELIVERY_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a rider',
    description: 'Soft-deletes a rider and marks them inactive.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug or ID',
  })
  @ApiParam({
    name: 'id',
    example: 'uuid',
    description: 'Rider ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Rider deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Rider not found' })
  async deleteRider(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const result = await this.riderService.deleteRider(tenantSlug, id);
    return ResponseHelper.success(result, result.message);
  }
}

