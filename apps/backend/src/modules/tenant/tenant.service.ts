import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '../../common/exceptions/business.exception';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Helper: Round number to 4 decimal places for rates
   */
  private round4(num: number): number {
    return Math.round((num + Number.EPSILON) * 10000) / 10000;
  }

  /**
   * Get restaurant settings by tenant slug or ID
   */
  async getTenantSettings(tenantSlugOrId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlugOrId }, { id: tenantSlugOrId }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      tagline: tenant.tagline || '',
      initials: tenant.initials || '',
      accent: tenant.accent || 'oklch(0.6 0.2 240)',
      currency: tenant.currency,
      locale: tenant.locale,
      taxRate: tenant.taxRate,
      serviceChargeRate: tenant.serviceChargeRate,
      receiptFooter: tenant.receiptFooter || '',
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
    };
  }

  /**
   * Update restaurant settings & identity
   */
  async updateTenantSettings(
    tenantSlugOrId: string,
    dto: UpdateTenantSettingsDto,
    user?: any,
  ) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlugOrId }, { id: tenantSlugOrId }],
      },
    });

    if (!tenant) {
      throw new NotFoundException('Restaurant');
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.tagline !== undefined) updateData.tagline = dto.tagline.trim();
    if (dto.initials !== undefined) updateData.initials = dto.initials.trim().toUpperCase();
    if (dto.accent !== undefined) updateData.accent = dto.accent.trim();
    if (dto.currency !== undefined) updateData.currency = dto.currency.trim();
    if (dto.locale !== undefined) updateData.locale = dto.locale.trim();
    if (dto.taxRate !== undefined) updateData.taxRate = this.round4(dto.taxRate);
    if (dto.serviceChargeRate !== undefined) updateData.serviceChargeRate = this.round4(dto.serviceChargeRate);
    if (dto.receiptFooter !== undefined) updateData.receiptFooter = dto.receiptFooter.trim();

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: updateData,
    });

    // Record audit log via event emitter
    this.eventEmitter.emit('activity.log', {
      type: 'TENANT_SETTINGS_UPDATE',
      tenantId: tenant.id,
      message: `Updated restaurant settings for ${updated.name}`,
      metadata: {
        userId: user?.id,
        userName: user?.name || user?.email,
        updatedFields: Object.keys(updateData),
      },
    });

    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      tagline: updated.tagline || '',
      initials: updated.initials || '',
      accent: updated.accent || 'oklch(0.6 0.2 240)',
      currency: updated.currency,
      locale: updated.locale,
      taxRate: updated.taxRate,
      serviceChargeRate: updated.serviceChargeRate,
      receiptFooter: updated.receiptFooter || '',
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
