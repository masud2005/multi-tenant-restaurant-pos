import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRiderDto, UpdateRiderDto, GetRidersQueryDto } from './dto';
import { Prisma } from '../../../prisma/generated/client';
import { NotFoundException } from '../../common/exceptions/business.exception';

@Injectable()
export class RiderService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveTenant(tenantSlugOrId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlugOrId }, { id: tenantSlugOrId }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    return tenant;
  }

  /**
   * Create a new delivery rider
   */
  async createRider(tenantSlug: string, dto: CreateRiderDto) {
    const tenant = await this.resolveTenant(tenantSlug);

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
    const trimmedPhone = dto.phone.trim();

    const rider = await this.prisma.rider.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: trimmedName,
        phone: trimmedPhone,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      include: {
        branch: {
          select: { id: true, name: true },
        },
      },
    });

    return rider;
  }

  /**
   * Get all delivery riders with branch and status filtering
   */
  async getRiders(tenantSlug: string, query: GetRidersQueryDto) {
    const tenant = await this.resolveTenant(tenantSlug);

    const where: Prisma.RiderWhereInput = {
      tenantId: tenant.id,
      isDeleted: false,
    };

    if (query?.branchId) {
      where.branchId = query.branchId;
    }

    if (query?.activeOnly !== undefined) {
      where.isActive = query.activeOnly;
    }

    if (query?.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    return this.prisma.rider.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        branch: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Get rider details by ID
   */
  async getRiderById(tenantSlug: string, id: string) {
    const tenant = await this.resolveTenant(tenantSlug);

    const rider = await this.prisma.rider.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        branch: {
          select: { id: true, name: true },
        },
      },
    });

    if (!rider) {
      throw new NotFoundException('Rider');
    }

    return rider;
  }

  /**
   * Update rider profile or status
   */
  async updateRider(tenantSlug: string, id: string, dto: UpdateRiderDto) {
    const tenant = await this.resolveTenant(tenantSlug);

    const rider = await this.prisma.rider.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!rider) {
      throw new NotFoundException('Rider');
    }

    if (dto.branchId && dto.branchId !== rider.branchId) {
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

    return this.prisma.rider.update({
      where: { id: rider.id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        phone: dto.phone !== undefined ? dto.phone.trim() : undefined,
        branchId: dto.branchId,
        isActive: dto.isActive,
      },
      include: {
        branch: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Soft-delete a rider
   */
  async deleteRider(tenantSlug: string, id: string) {
    const tenant = await this.resolveTenant(tenantSlug);

    const rider = await this.prisma.rider.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!rider) {
      throw new NotFoundException('Rider');
    }

    await this.prisma.rider.update({
      where: { id: rider.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return {
      success: true,
      message: `Rider ${rider.name} deleted successfully`,
    };
  }
}

