import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import {
  NotFoundException,
  AlreadyExistsException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class BranchService {
  constructor(private readonly prisma: PrismaService) {}

  async createBranch(tenantSlug: string, dto: CreateBranchDto) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const trimmedName = dto.name.trim();

    // 2. Check if branch with this name already exists for this tenant (case-insensitive)
    const existingBranch = await this.prisma.branch.findFirst({
      where: {
        tenantId: tenant.id,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (existingBranch) {
      throw new AlreadyExistsException('A branch with this name');
    }

    // 3. Create branch
    const branch = await this.prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: trimmedName,
        address: dto.address?.trim() || '',
        phone: dto.phone?.trim() || '',
        isActive: true,
      },
    });

    return branch;
  }

  async getAllBranches(tenantSlug: string) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Fetch all branches for this tenant
    return this.prisma.branch.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getBranchById(tenantSlug: string, branchId: string) {
    // 1. Verify tenant exists (support both slug and id)
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    // 2. Fetch branch
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        tenantId: tenant.id,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch');
    }

    return branch;
  }

  async updateBranch(
    tenantSlug: string,
    branchId: string,
    dto: UpdateBranchDto,
  ) {
    // 1. Verify branch exists in tenant
    const branch = await this.getBranchById(tenantSlug, branchId);

    // 2. If name is being changed, verify uniqueness
    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const existingBranch = await this.prisma.branch.findFirst({
        where: {
          tenantId: branch.tenantId,
          name: {
            equals: trimmedName,
            mode: 'insensitive',
          },
          id: { not: branchId },
        },
      });

      if (existingBranch) {
        throw new AlreadyExistsException('A branch with this name');
      }
    }

    // 3. Update branch
    const updatedBranch = await this.prisma.branch.update({
      where: { id: branchId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.address !== undefined && { address: dto.address.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return updatedBranch;
  }

  async toggleBranchStatus(tenantSlug: string, branchId: string) {
    // 1. Verify branch exists in tenant
    const branch = await this.getBranchById(tenantSlug, branchId);

    // 2. Toggle status (preserves all historical orders and transactions)
    const updatedBranch = await this.prisma.branch.update({
      where: { id: branchId },
      data: {
        isActive: !branch.isActive,
      },
    });

    return updatedBranch;
  }
}
