import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAuditLogDto, GetAuditLogsQueryDto } from './dto';
import { NotFoundException } from '../../common/exceptions/business.exception';
import { Prisma } from '../../../prisma/generated/client';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to resolve tenant by either slug or UUID
   */
  async resolveTenant(tenantSlugOrId: string) {
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
   * Record a new audit log entry
   */
  async createLog(tenantSlugOrId: string, dto: CreateAuditLogDto) {
    const tenant = await this.resolveTenant(tenantSlugOrId);

    // Verify branch if provided
    let branchId: string | null = null;
    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId: tenant.id },
      });
      if (branch) {
        branchId = branch.id;
      }
    }

    return this.prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        branchId,
        actorId: dto.actorId || null,
        actorName: dto.actorName?.trim() || 'System',
        actorRole: dto.actorRole || null,
        action: dto.action.trim().toLowerCase(),
        entity: dto.entity.trim().toLowerCase(),
        entityId: dto.entityId || null,
        summary: dto.summary.trim(),
        details: dto.details?.trim() || '',
        metadata: dto.metadata ?? Prisma.JsonNull,
        ipAddress: dto.ipAddress || null,
        userAgent: dto.userAgent || null,
      },
    });
  }

  /**
   * Retrieve audit logs with flexible filtering and search
   */
  async findAll(tenantSlugOrId: string, query: GetAuditLogsQueryDto = {}) {
    const tenant = await this.resolveTenant(tenantSlugOrId);

    const where: Prisma.AuditLogWhereInput = {
      tenantId: tenant.id,
    };

    if (query.entity && query.entity !== 'all') {
      where.entity = {
        equals: query.entity.trim().toLowerCase(),
        mode: 'insensitive',
      };
    }

    if (query.action && query.action !== 'all') {
      where.action = {
        equals: query.action.trim().toLowerCase(),
        mode: 'insensitive',
      };
    }

    if (query.branchId && query.branchId !== 'all') {
      where.branchId = query.branchId;
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { summary: { contains: s, mode: 'insensitive' } },
        { actorName: { contains: s, mode: 'insensitive' } },
        { details: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (query.startDate) {
        dateFilter.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        // Set to end of the day if date string only
        const end = new Date(query.endDate);
        if (query.endDate.length <= 10) {
          end.setHours(23, 59, 59, 999);
        }
        dateFilter.lte = end;
      }
      where.createdAt = dateFilter;
    }

    const page = query.page ? Math.max(parseInt(query.page, 10), 1) : 1;
    const limit = query.limit
      ? Math.min(Math.max(parseInt(query.limit, 10), 1), 200)
      : 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get audit statistics (counts by entity and time range)
   */
  async getStats(tenantSlugOrId: string) {
    const tenant = await this.resolveTenant(tenantSlugOrId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [total, today, criticalCount, entityGroups] = await Promise.all([
      this.prisma.auditLog.count({ where: { tenantId: tenant.id } }),
      this.prisma.auditLog.count({
        where: { tenantId: tenant.id, createdAt: { gte: startOfDay } },
      }),
      this.prisma.auditLog.count({
        where: {
          tenantId: tenant.id,
          action: { in: ['void', 'refund', 'delete'] },
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ['entity'],
        where: { tenantId: tenant.id },
        _count: { id: true },
      }),
    ]);

    const byEntity: Record<string, number> = {};
    for (const g of entityGroups) {
      byEntity[g.entity] = g._count.id;
    }

    return {
      total,
      today,
      criticalCount,
      byEntity,
    };
  }
}
