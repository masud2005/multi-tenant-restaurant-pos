import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
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
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { GetCustomersQueryDto } from './dto/get-customers-query.dto';
import { ResponseHelper } from '../../common/helpers/response.helper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('(Tenant) Customers & Loyalty')
@Controller('tenants')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post(':tenantSlug/customers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new customer',
    description:
      'Creates a new customer for the restaurant tenant with optional initial points and loyalty tier.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug or ID',
  })
  @ApiResponse({
    status: 201,
    description: 'Customer created successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({
    status: 409,
    description: 'Customer with this phone number already exists',
  })
  async createCustomer(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateCustomerDto,
  ) {
    const customer = await this.customerService.createCustomer(tenantSlug, dto);
    return ResponseHelper.created(customer, 'Customer created successfully');
  }

  @Get(':tenantSlug/customers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List / Search customers',
    description:
      'Retrieves all customers for a restaurant with pagination, name/phone search, and tier filters.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
    description: 'Restaurant slug or ID',
  })
  async getCustomers(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: GetCustomersQueryDto,
  ) {
    const result = await this.customerService.getCustomers(tenantSlug, query);
    return ResponseHelper.success(result, 'Customers retrieved successfully');
  }

  @Get(':tenantSlug/customers/by-phone/:phone')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Quick customer search by phone for POS checkout',
    description:
      'Looks up a customer by phone number to quickly fetch their loyalty points and tier discount.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  @ApiParam({
    name: 'phone',
    example: '+8801712345678',
  })
  async getCustomerByPhone(
    @Param('tenantSlug') tenantSlug: string,
    @Param('phone') phone: string,
  ) {
    const customer = await this.customerService.getCustomerByPhone(
      tenantSlug,
      phone,
    );
    return ResponseHelper.success(customer, 'Customer found');
  }

  @Get(':tenantSlug/customers/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get customer profile by ID',
    description:
      'Retrieves customer details, loyalty points balance, recent orders, and points transaction history.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  @ApiParam({
    name: 'id',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  async getCustomerById(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const customer = await this.customerService.getCustomerById(tenantSlug, id);
    return ResponseHelper.success(customer, 'Customer details retrieved');
  }

  @Put(':tenantSlug/customers/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update customer profile',
    description: 'Updates customer information like name, phone, address, tier, or notes.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  @ApiParam({
    name: 'id',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  async updateCustomer(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const updated = await this.customerService.updateCustomer(
      tenantSlug,
      id,
      dto,
    );
    return ResponseHelper.success(updated, 'Customer updated successfully');
  }

  @Delete(':tenantSlug/customers/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete customer',
    description: 'Soft deletes a customer from the restaurant records.',
  })
  @ApiParam({
    name: 'tenantSlug',
    example: 'sultans-dine',
  })
  @ApiParam({
    name: 'id',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  async deleteCustomer(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    const result = await this.customerService.deleteCustomer(tenantSlug, id);
    return ResponseHelper.success(result, 'Customer deleted successfully');
  }
}
