import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { GetTablesQueryDto } from './dto/get-tables-query.dto';
import {
  OrderStatus,
  Prisma,
  TableStatus,
} from '../../../prisma/generated/client';
import {
  NotFoundException,
  AlreadyExistsException,
  ConflictException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class TableService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveTenant(tenantSlugOrId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantSlugOrId },
          { id: tenantSlugOrId },
        ],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    return tenant;
  }

  /**
   * Create a new dining table for a restaurant branch
   */
  async createTable(tenantSlug: string, dto: CreateTableDto) {
    // 1. Verify tenant exists by slug or id
    const tenant = await this.resolveTenant(tenantSlug);

    // 2. Verify that branch exists and belongs to this tenant
    let branch = null;
    if (dto.branchId) {
      branch = await this.prisma.branch.findFirst({
        where: {
          id: dto.branchId,
          tenantId: tenant.id,
          isActive: true,
        },
      });
    }

    if (!branch) {
      branch = await this.prisma.branch.findFirst({
        where: {
          tenantId: tenant.id,
          isActive: true,
        },
      });
    }

    if (!branch) {
      throw new NotFoundException('Branch');
    }

    const trimmedName = dto.name.trim();

    // 3. Check if table name already exists in this branch (case-insensitive)
    const existingTable = await this.prisma.diningTable.findFirst({
      where: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        isDeleted: false,
      },
    });

    if (existingTable) {
      throw new AlreadyExistsException(`Table with name "${trimmedName}"`);
    }

    // 4. Create the dining table in the database
    const table = await this.prisma.diningTable.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: trimmedName,
        seats: dto.seats ?? 4,
        area: dto.area?.trim() || 'Main hall',
        shape: dto.shape || 'square',
        status: dto.status || TableStatus.AVAILABLE,
        x: dto.x ?? 0,
        y: dto.y ?? 0,
        isActive: true,
      },
    });

    return table;
  }

  /**
   * Get all dining tables for a restaurant with optional filters (branch, status, area, search)
   */
  async getTables(tenantSlug: string, query: GetTablesQueryDto) {
    // 1. Verify tenant exists by slug or id
    const tenant = await this.resolveTenant(tenantSlug);

    // 2. If branchId is specified, verify that the branch belongs to this tenant
    if (query.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: query.branchId,
          tenantId: tenant.id,
          isActive: true,
        },
      });

      if (!branch) {
        throw new NotFoundException('Branch');
      }
    }

    // 3. Build dynamic filter criteria
    const where: Prisma.DiningTableWhereInput = {
      tenantId: tenant.id,
      isDeleted: false,
      isActive: true,
    };

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.area) {
      where.area = {
        equals: query.area.trim(),
        mode: 'insensitive',
      };
    }

    if (query.search) {
      where.name = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    // 4. Fetch dining tables ordered by floor area and table name
    const tables = await this.prisma.diningTable.findMany({
      where,
      orderBy: [{ area: 'asc' }, { name: 'asc' }],
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        orders: {
          where: {
            status: {
              in: [
                OrderStatus.IN_KITCHEN,
                OrderStatus.READY,
                OrderStatus.SERVED,
              ],
            },
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            kitchenStatus: true,
            total: true,
            createdAt: true,
          },
        },
      },
    });

    return tables;
  }

  /**
   * Get a single dining table by ID
   */
  async getTableById(tenantSlug: string, tableId: string) {
    // 1. Verify tenant exists
    const tenant = await this.resolveTenant(tenantSlug);

    // 2. Fetch table
    const table = await this.prisma.diningTable.findFirst({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
        OR: [
          { id: tableId },
          { name: tableId },
        ],
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        orders: {
          where: {
            status: {
              in: [
                OrderStatus.IN_KITCHEN,
                OrderStatus.READY,
                OrderStatus.SERVED,
              ],
            },
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            kitchenStatus: true,
            total: true,
            createdAt: true,
          },
        },
      },
    });

    if (!table) {
      throw new NotFoundException('Dining table');
    }

    return table;
  }

  /**
   * Update an existing dining table
   */
  async updateTable(
    tenantSlug: string,
    tableId: string,
    dto: UpdateTableDto,
  ) {
    // 1. Verify tenant exists
    const tenant = await this.resolveTenant(tenantSlug);

    // 2. Verify table exists for this tenant
    const table = await this.prisma.diningTable.findFirst({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
        OR: [
          { id: tableId },
          { name: tableId },
        ],
      },
    });

    if (!table) {
      throw new NotFoundException('Dining table');
    }

    // 3. If branchId is being changed, verify target branch exists and belongs to this tenant
    if (dto.branchId && dto.branchId !== table.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: dto.branchId,
          tenantId: tenant.id,
          isActive: true,
        },
      });

      if (!branch) {
        throw new NotFoundException('Branch');
      }
    }

    // 4. If table name is being changed, verify uniqueness within the target branch
    const targetBranchId = dto.branchId || table.branchId;
    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const existingTable = await this.prisma.diningTable.findFirst({
        where: {
          tenantId: tenant.id,
          branchId: targetBranchId,
          name: {
            equals: trimmedName,
            mode: 'insensitive',
          },
          id: { not: table.id },
          isDeleted: false,
        },
      });

      if (existingTable) {
        throw new AlreadyExistsException(`Table with name "${trimmedName}"`);
      }
    }

    // 5. Update the table record
    const updatedTable = await this.prisma.diningTable.update({
      where: { id: table.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.branchId !== undefined && { branchId: dto.branchId }),
        ...(dto.seats !== undefined && { seats: dto.seats }),
        ...(dto.area !== undefined && { area: dto.area.trim() }),
        ...(dto.shape !== undefined && { shape: dto.shape }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.x !== undefined && { x: dto.x }),
        ...(dto.y !== undefined && { y: dto.y }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return updatedTable;
  }

  /**
   * Soft delete a dining table (sets isDeleted: true, deletedAt: now, isActive: false)
   */
  async softDeleteTable(tenantSlug: string, tableId: string) {
    // 1. Verify tenant exists
    const tenant = await this.resolveTenant(tenantSlug);

    // 2. Verify table exists
    const table = await this.prisma.diningTable.findFirst({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
        OR: [
          { id: tableId },
          { name: tableId },
        ],
      },
    });

    if (!table) {
      throw new NotFoundException('Dining table');
    }

    // 3. Safety check: Cannot delete table if occupied or has active orders
    const activeOrder = await this.prisma.order.findFirst({
      where: {
        tableId: table.id,
        status: {
          in: [
            OrderStatus.IN_KITCHEN,
            OrderStatus.READY,
            OrderStatus.SERVED,
          ],
        },
      },
    });

    if (activeOrder || table.status === TableStatus.OCCUPIED) {
      throw new ConflictException(
        `Cannot delete table "${table.name}" because it is currently occupied or has an active order`,
      );
    }

    // 4. Perform soft delete
    await this.prisma.diningTable.update({
      where: { id: table.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return {
      message: `Table "${table.name}" deleted successfully`,
    };
  }

  /**
   * Update table status (AVAILABLE, OCCUPIED, RESERVED, CLEANING)
   */
  async updateTableStatus(
    tenantSlug: string,
    tableId: string,
    status: TableStatus,
  ) {
    // 1. Verify tenant exists
    const tenant = await this.resolveTenant(tenantSlug);

    // 2. Verify table exists for this tenant
    const table = await this.prisma.diningTable.findFirst({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
        OR: [
          { id: tableId },
          { name: tableId },
        ],
      },
    });

    if (!table) {
      throw new NotFoundException('Dining table');
    }

    // 3. Update the table status
    const updatedTable = await this.prisma.diningTable.update({
      where: { id: table.id },
      data: { status },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updatedTable;
  }
}

