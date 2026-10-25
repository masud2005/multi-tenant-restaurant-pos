import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLoyaltyTierDto } from './dto/create-loyalty-tier.dto';
import { UpdateLoyaltyTierDto } from './dto/update-loyalty-tier.dto';
import { UpdateLoyaltySettingsDto } from './dto/update-loyalty-settings.dto';
import {
  NotFoundException,
  AlreadyExistsException,
} from '../../common/exceptions/business.exception';

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: Resolve tenant by slug or ID
   */
  private async getTenant(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    return tenant;
  }

  // ==========================================
  // LOYALTY SETTINGS
  // ==========================================

  /**
   * Get restaurant loyalty policy settings (auto-initializes defaults if not present)
   */
  async getSettings(tenantSlug: string) {
    const tenant = await this.getTenant(tenantSlug);

    let settings = await this.prisma.loyaltySettings.findUnique({
      where: { tenantId: tenant.id },
    });

    if (!settings) {
      settings = await this.prisma.loyaltySettings.create({
        data: {
          tenantId: tenant.id,
          isEnabled: true,
          spendAmountPerPoint: 100.0, // 100 BDT spend = 1 point
          pointValue: 1.0,           // 1 point = 1 BDT discount
          minPointsToRedeem: 10,     // 10 points threshold to redeem
        },
      });
    }

    return settings;
  }

  /**
   * Update restaurant loyalty policy settings
   */
  async updateSettings(tenantSlug: string, dto: UpdateLoyaltySettingsDto) {
    const tenant = await this.getTenant(tenantSlug);

    const settings = await this.prisma.loyaltySettings.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        isEnabled: dto.isEnabled !== undefined ? dto.isEnabled : true,
        spendAmountPerPoint: dto.spendAmountPerPoint ?? 100.0,
        pointValue: dto.pointValue ?? 1.0,
        minPointsToRedeem: dto.minPointsToRedeem ?? 10,
        maxPointsPerOrder: dto.maxPointsPerOrder,
        expireAfterDays: dto.expireAfterDays,
      },
      update: {
        isEnabled: dto.isEnabled !== undefined ? dto.isEnabled : undefined,
        spendAmountPerPoint: dto.spendAmountPerPoint,
        pointValue: dto.pointValue,
        minPointsToRedeem: dto.minPointsToRedeem,
        maxPointsPerOrder: dto.maxPointsPerOrder,
        expireAfterDays: dto.expireAfterDays,
      },
    });

    return settings;
  }

  // ==========================================
  // LOYALTY TIER RULES
  // ==========================================

  /**
   * Get all loyalty tiers for a restaurant (auto-seeds defaults if empty)
   */
  async getTiers(tenantSlug: string) {
    const tenant = await this.getTenant(tenantSlug);

    let tiers = await this.prisma.loyaltyTier.findMany({
      where: {
        tenantId: tenant.id,
        isDeleted: false,
      },
      orderBy: [{ sortOrder: 'asc' }, { minSpend: 'asc' }],
      include: {
        _count: {
          select: { customers: { where: { isDeleted: false } } },
        },
      },
    });

    // Auto-seed standard starter tiers if none exist
    if (tiers.length === 0) {
      const anyTiersCount = await this.prisma.loyaltyTier.count({
        where: { tenantId: tenant.id },
      });

      if (anyTiersCount === 0) {
        const defaultTiers = [
          {
            name: 'Bronze',
            minSpend: 0,
            minPoints: 0,
            pointMultiplier: 1.0,
            discountPercent: 0.0,
            description: 'Entry-level tier for all registered customers',
            color: '#CD7F32',
            sortOrder: 0,
          },
          {
            name: 'Silver',
            minSpend: 5000,
            minPoints: 50,
            pointMultiplier: 1.2,
            discountPercent: 3.0,
            description: 'Earn 1.2x points and 3% flat discount on orders',
            color: '#94A3B8',
            sortOrder: 1,
          },
          {
            name: 'Gold',
            minSpend: 15000,
            minPoints: 150,
            pointMultiplier: 1.5,
            discountPercent: 5.0,
            description: 'VIP status with 1.5x points and 5% flat discount',
            color: '#EAB308',
            sortOrder: 2,
          },
        ];

        await Promise.all(
          defaultTiers.map((tier) =>
            this.prisma.loyaltyTier.create({
              data: {
                tenantId: tenant.id,
                ...tier,
              },
            }),
          ),
        );

        tiers = await this.prisma.loyaltyTier.findMany({
          where: {
            tenantId: tenant.id,
            isDeleted: false,
          },
          orderBy: [{ sortOrder: 'asc' }, { minSpend: 'asc' }],
          include: {
            _count: {
              select: { customers: { where: { isDeleted: false } } },
            },
          },
        });
      }
    }

    return tiers;
  }

  /**
   * Create a new loyalty tier rule
   */
  async createTier(tenantSlug: string, dto: CreateLoyaltyTierDto) {
    const tenant = await this.getTenant(tenantSlug);
    const trimmedName = dto.name.trim();

    // Check for duplicate tier name within this restaurant
    const existing = await this.prisma.loyaltyTier.findFirst({
      where: {
        tenantId: tenant.id,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        isDeleted: false,
      },
    });

    if (existing) {
      throw new AlreadyExistsException(
        `Loyalty tier with name "${trimmedName}"`,
      );
    }

    const tier = await this.prisma.loyaltyTier.create({
      data: {
        tenantId: tenant.id,
        name: trimmedName,
        minSpend: dto.minSpend ?? 0.0,
        minPoints: dto.minPoints ?? 0,
        pointMultiplier: dto.pointMultiplier ?? 1.0,
        discountPercent: dto.discountPercent ?? 0.0,
        description: dto.description?.trim() || '',
        color: dto.color?.trim() || '#3B82F6',
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return tier;
  }

  /**
   * Get single tier details by ID
   */
  async getTierById(tenantSlug: string, tierId: string) {
    const tenant = await this.getTenant(tenantSlug);

    const tier = await this.prisma.loyaltyTier.findFirst({
      where: {
        id: tierId,
        tenantId: tenant.id,
        isDeleted: false,
      },
      include: {
        _count: {
          select: { customers: { where: { isDeleted: false } } },
        },
      },
    });

    if (!tier) {
      throw new NotFoundException('Loyalty Tier');
    }

    return tier;
  }

  /**
   * Update an existing loyalty tier
   */
  async updateTier(
    tenantSlug: string,
    tierId: string,
    dto: UpdateLoyaltyTierDto,
  ) {
    const tenant = await this.getTenant(tenantSlug);

    const tier = await this.prisma.loyaltyTier.findFirst({
      where: {
        id: tierId,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!tier) {
      throw new NotFoundException('Loyalty Tier');
    }

    // If name is updated, check for duplicate name
    if (dto.name && dto.name.trim() !== tier.name) {
      const duplicate = await this.prisma.loyaltyTier.findFirst({
        where: {
          tenantId: tenant.id,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          isDeleted: false,
          NOT: { id: tier.id },
        },
      });

      if (duplicate) {
        throw new AlreadyExistsException(
          `Loyalty tier with name "${dto.name.trim()}"`,
        );
      }
    }

    const updated = await this.prisma.loyaltyTier.update({
      where: { id: tier.id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        minSpend: dto.minSpend !== undefined ? dto.minSpend : undefined,
        minPoints: dto.minPoints !== undefined ? dto.minPoints : undefined,
        pointMultiplier:
          dto.pointMultiplier !== undefined ? dto.pointMultiplier : undefined,
        discountPercent:
          dto.discountPercent !== undefined ? dto.discountPercent : undefined,
        description:
          dto.description !== undefined ? dto.description.trim() : undefined,
        color: dto.color !== undefined ? dto.color.trim() : undefined,
        sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
      },
    });

    return updated;
  }

  /**
   * Soft delete a loyalty tier
   */
  async deleteTier(tenantSlug: string, tierId: string) {
    const tenant = await this.getTenant(tenantSlug);

    const tier = await this.prisma.loyaltyTier.findFirst({
      where: {
        id: tierId,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!tier) {
      throw new NotFoundException('Loyalty Tier');
    }

    // Unset tierId from customers attached to this tier before soft delete
    await this.prisma.customer.updateMany({
      where: {
        tenantId: tenant.id,
        tierId: tier.id,
      },
      data: {
        tierId: null,
      },
    });

    // Soft delete by setting isDeleted: true and deletedAt: now()
    await this.prisma.loyaltyTier.update({
      where: { id: tier.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return { success: true, message: 'Loyalty tier deleted successfully' };
  }
}
