import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import {
  GetPromotionsQueryDto,
  PromotionStatusFilter,
} from './dto/get-promotions-query.dto';
import { DiscountKind } from '../../../prisma/generated/client';

export type PromotionComputedStatus =
  | 'LIVE'
  | 'SCHEDULED'
  | 'ENDED'
  | 'PAUSED'
  | 'USED_UP';

@Injectable()
export class PromotionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve tenant entity by either slug or id
   */
  private async resolveTenant(tenantSlugOrId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlugOrId }, { id: tenantSlugOrId }],
      },
    });

    if (!tenant) {
      throw new NotFoundException(
        `Restaurant tenant "${tenantSlugOrId}" not found`,
      );
    }
    return tenant;
  }

  /**
   * Helper: compute dynamic lifecycle status of a promotion
   */
  public computePromotionStatus(
    promo: {
      active: boolean;
      startsAt: Date;
      endsAt: Date;
      uses: number;
      maxUses: number | null;
    },
    now = new Date(),
  ): PromotionComputedStatus {
    if (!promo.active) return 'PAUSED';
    if (now < new Date(promo.startsAt)) return 'SCHEDULED';
    if (now > new Date(promo.endsAt)) return 'ENDED';
    if (promo.maxUses !== null && promo.uses >= promo.maxUses) return 'USED_UP';
    return 'LIVE';
  }

  /**
   * Helper: enrich promotion record with computed metrics
   */
  private enrichPromotion(promo: any, now = new Date()) {
    const computedStatus = this.computePromotionStatus(promo, now);
    const remainingUses =
      promo.maxUses !== null ? Math.max(0, promo.maxUses - promo.uses) : null;
    const isAvailable = computedStatus === 'LIVE';
    const usagePercent =
      promo.maxUses && promo.maxUses > 0
        ? Math.round((promo.uses / promo.maxUses) * 100)
        : null;

    return {
      ...promo,
      computedStatus,
      remainingUses,
      isAvailable,
      usagePercent,
    };
  }

  /**
   * Create a new promotion for a restaurant tenant
   */
  async createPromotion(tenantSlug: string, dto: CreatePromotionDto) {
    const tenant = await this.resolveTenant(tenantSlug);

    const code = dto.code.trim().toUpperCase();

    // 1. Validate Code regex
    if (!/^[A-Z0-9]{3,16}$/.test(code)) {
      throw new BadRequestException(
        'Code must be 3–16 letters or digits (alphanumeric).',
      );
    }

    // 2. Validate Discount Value & Cap
    if (dto.value <= 0) {
      throw new BadRequestException(
        'Enter a valid discount value greater than 0.',
      );
    }

    if (dto.kind === DiscountKind.PERCENT && dto.value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%.');
    }

    // 3. Validate Date Range
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const endsAt = new Date(dto.endsAt);

    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
      throw new BadRequestException('Invalid date format provided.');
    }

    if (endsAt < startsAt) {
      throw new BadRequestException(
        'End date must be on or after the start date.',
      );
    }

    // 4. Check for duplicate code within active promotions of this tenant
    const existing = await this.prisma.promotion.findFirst({
      where: {
        tenantId: tenant.id,
        code,
        isDeleted: false,
      },
    });

    if (existing) {
      throw new ConflictException(
        `A promotion with code "${code}" already exists for this restaurant.`,
      );
    }

    // 5. Create promotion record
    const created = await this.prisma.promotion.create({
      data: {
        tenantId: tenant.id,
        name: dto.name.trim(),
        code,
        kind: dto.kind,
        value: dto.value,
        minSpend: dto.minSpend ?? 0,
        startsAt,
        endsAt,
        maxUses: dto.maxUses ?? null,
        active: dto.active ?? true,
        uses: 0,
      },
    });

    return this.enrichPromotion(created);
  }

  /**
   * GET 1: List / search / filter promotions with pagination and computed status
   */
  async getPromotions(tenantSlug: string, query?: GetPromotionsQueryDto) {
    const tenant = await this.resolveTenant(tenantSlug);
    const now = new Date();

    const where: Prisma.PromotionWhereInput = {
      tenantId: tenant.id,
      isDeleted: false,
    };

    // 1. Search filter: Match name or promo code
    if (query?.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { code: { contains: term.toUpperCase(), mode: 'insensitive' } },
      ];
    }

    // 2. Exact code filter
    if (query?.code && query.code.trim()) {
      where.code = query.code.trim().toUpperCase();
    }

    // 3. Discount Kind filter (PERCENT or AMOUNT)
    if (query?.kind) {
      where.kind = query.kind;
    }

    // 4. Status filter
    if (query?.status && query.status !== PromotionStatusFilter.ALL) {
      switch (query.status) {
        case PromotionStatusFilter.PAUSED:
          where.active = false;
          break;
        case PromotionStatusFilter.SCHEDULED:
          where.active = true;
          where.startsAt = { gt: now };
          break;
        case PromotionStatusFilter.ENDED:
          where.endsAt = { lt: now };
          break;
        case PromotionStatusFilter.USED_UP:
          where.maxUses = { not: null };
          break;
        case PromotionStatusFilter.LIVE:
          where.active = true;
          where.startsAt = { lte: now };
          where.endsAt = { gte: now };
          break;
      }
    }

    // 5. Pagination calculation
    const page = query?.page && query.page > 0 ? query.page : 1;
    const limit = query?.limit !== undefined ? query.limit : 20;

    let total = await this.prisma.promotion.count({ where });

    // Fetch items
    const findOptions: Prisma.PromotionFindManyArgs = {
      where,
      orderBy: { createdAt: 'desc' },
    };

    if (limit > 0) {
      findOptions.skip = (page - 1) * limit;
      findOptions.take = limit;
    }

    const records = await this.prisma.promotion.findMany(findOptions);

    let enriched = records.map((p: any) => this.enrichPromotion(p, now));

    // Post-filter for USED_UP or LIVE when maxUses condition requires comparison
    if (query?.status === PromotionStatusFilter.USED_UP) {
      enriched = enriched.filter((p: any) => p.computedStatus === 'USED_UP');
      total = enriched.length;
    } else if (query?.status === PromotionStatusFilter.LIVE) {
      enriched = enriched.filter((p: any) => p.computedStatus === 'LIVE');
      total = enriched.length;
    }

    return {
      items: enriched,
      total,
      page,
      limit,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
    };
  }

  /**
   * GET 2: Get single promotion by ID with detailed metrics
   */
  async getPromotionById(tenantSlug: string, id: string) {
    const tenant = await this.resolveTenant(tenantSlug);

    const promotion = await this.prisma.promotion.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found.');
    }

    return this.enrichPromotion(promotion);
  }

  /**
   * GET 3: Validate promo code in real-time during POS checkout
   */
  async checkPromotionValidity(
    tenantSlug: string,
    code: string,
    subtotal?: number,
  ) {
    const tenant = await this.resolveTenant(tenantSlug);
    const cleanCode = code.trim().toUpperCase();

    // 1. Find promo code under the specific tenant
    const promo = await this.prisma.promotion.findFirst({
      where: {
        tenantId: tenant.id,
        code: cleanCode,
        isDeleted: false,
      },
    });

    if (!promo) {
      throw new NotFoundException(`Promo code "${cleanCode}" not found.`);
    }

    // 2. Active status check
    if (!promo.active) {
      throw new BadRequestException('This promotion is currently paused.');
    }

    const now = new Date();

    // 3. Start date check
    if (now < new Date(promo.startsAt)) {
      throw new BadRequestException("This promotion hasn't started yet.");
    }

    // 4. End date check
    if (now > new Date(promo.endsAt)) {
      throw new BadRequestException('This promotion has ended.');
    }

    // 5. Usage cap check
    if (promo.maxUses !== null && promo.uses >= promo.maxUses) {
      throw new BadRequestException(
        'This promotion has reached its maximum usage limit.',
      );
    }

    // 6. Minimum spend check (if subtotal is passed)
    if (subtotal !== undefined && subtotal < promo.minSpend) {
      throw new BadRequestException(
        `Minimum spend for ${promo.code} is ${promo.minSpend} BDT. Your subtotal is ${subtotal} BDT.`,
      );
    }

    // 7. Calculate discount amount in real-time
    let discountAmount = 0;
    if (subtotal !== undefined && subtotal > 0) {
      if (promo.kind === DiscountKind.PERCENT) {
        discountAmount = Math.round(((subtotal * promo.value) / 100) * 100) / 100;
      } else {
        discountAmount = Math.min(subtotal, promo.value);
      }
    }

    const finalTotal =
      subtotal !== undefined ? Math.max(0, subtotal - discountAmount) : undefined;

    return {
      promotion: this.enrichPromotion(promo, now),
      discountAmount,
      finalTotal,
      isValid: true,
    };
  }

  /**
   * Update an existing promotion with business validation
   */
  async updatePromotion(
    tenantSlug: string,
    id: string,
    dto: UpdatePromotionDto,
  ) {
    const tenant = await this.resolveTenant(tenantSlug);

    // 1. Verify existence
    const promotion = await this.prisma.promotion.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found.');
    }

    // 2. If code is changed, validate pattern and uniqueness
    let cleanCode: string | undefined = undefined;
    if (dto.code && dto.code.trim()) {
      cleanCode = dto.code.trim().toUpperCase();
      if (!/^[A-Z0-9]{3,16}$/.test(cleanCode)) {
        throw new BadRequestException(
          'Code must be 3–16 letters or digits (alphanumeric).',
        );
      }

      if (cleanCode !== promotion.code) {
        const existing = await this.prisma.promotion.findFirst({
          where: {
            tenantId: tenant.id,
            code: cleanCode,
            id: { not: id },
            isDeleted: false,
          },
        });
        if (existing) {
          throw new ConflictException(
            `A promotion with code "${cleanCode}" already exists for this restaurant.`,
          );
        }
      }
    }

    // 3. Validate Value and Cap
    const effectiveKind = dto.kind ?? promotion.kind;
    const effectiveValue = dto.value !== undefined ? dto.value : promotion.value;

    if (effectiveValue <= 0) {
      throw new BadRequestException(
        'Enter a valid discount value greater than 0.',
      );
    }

    if (effectiveKind === DiscountKind.PERCENT && effectiveValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%.');
    }

    // 4. Validate Date Range
    const effectiveStartsAt = dto.startsAt
      ? new Date(dto.startsAt)
      : promotion.startsAt;
    const effectiveEndsAt = dto.endsAt
      ? new Date(dto.endsAt)
      : promotion.endsAt;

    if (
      isNaN(effectiveStartsAt.getTime()) ||
      isNaN(effectiveEndsAt.getTime())
    ) {
      throw new BadRequestException('Invalid date format provided.');
    }

    if (effectiveEndsAt < effectiveStartsAt) {
      throw new BadRequestException(
        'End date must be on or after the start date.',
      );
    }

    // 5. Validate minSpend & maxUses
    if (dto.minSpend !== undefined && dto.minSpend < 0) {
      throw new BadRequestException('Minimum spend cannot be negative.');
    }

    if (dto.maxUses !== undefined && dto.maxUses !== null && dto.maxUses < 1) {
      throw new BadRequestException('Max uses must be at least 1.');
    }

    // 6. Execute update
    const updated = await this.prisma.promotion.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(cleanCode && { code: cleanCode }),
        ...(dto.kind && { kind: dto.kind }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.minSpend !== undefined && { minSpend: dto.minSpend }),
        ...(dto.startsAt && { startsAt: effectiveStartsAt }),
        ...(dto.endsAt && { endsAt: effectiveEndsAt }),
        ...(dto.maxUses !== undefined && { maxUses: dto.maxUses }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });

    return this.enrichPromotion(updated);
  }

  /**
   * Soft delete a promotion
   */
  async deletePromotion(tenantSlug: string, id: string) {
    const tenant = await this.resolveTenant(tenantSlug);

    const promotion = await this.prisma.promotion.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found.');
    }

    await this.prisma.promotion.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return { success: true, message: 'Promotion deleted successfully' };
  }
}

