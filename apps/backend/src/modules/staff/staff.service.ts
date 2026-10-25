import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UserRole, UserStatus } from '../../../prisma/generated/client';
import {
  ConflictException,
  NotFoundException,
} from '../../common/exceptions/business.exception';
import { DEFAULT_ROLE_PERMISSIONS } from '../../common/constants/permissions.constant';
import { EmailService } from '../../shared/mail/email-service';
import { baseEmailTemplate } from '../../shared/mail/templates/base-email.template';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private async resolveTenant(tenantSlug: string) {
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

  private async sendInvitationEmail(
    to: string,
    name: string,
    restaurantName: string,
    role: string,
    inviteToken: string,
  ): Promise<{ sent: boolean; inviteUrl: string; isPlaceholder?: boolean; error?: string }> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/invite?token=${inviteToken}`;
    const subject = `You're invited to join ${restaurantName} on Tablewise POS`;
    const content = `
      <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
        You have been invited to join <strong>${restaurantName}</strong> as a <strong>${role}</strong>.
      </p>
      <p style="font-size: 14px; line-height: 1.5; margin-bottom: 30px;">
        Please click the button below to accept your invitation and set up your password:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteUrl}" class="btn" style="background-color: #7F41F0; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Accept Invitation & Set Password
        </a>
      </div>
      <p style="font-size: 12px; color: #a0a0a0; margin-top: 30px;">
        Or copy and paste this link in your browser:<br/>
        <a href="${inviteUrl}" style="color: #9d71ea;">${inviteUrl}</a>
      </p>
      <p style="font-size: 12px; color: #a0a0a0;">This invitation link will expire in 7 days.</p>
    `;

    const html = baseEmailTemplate(`Team Invitation - ${restaurantName}`, content);
    const result = await this.emailService.sendEmail(to, subject, html);
    if (result.success) {
      this.logger.log(`[STAFF_INVITE] Invitation email delivered via SMTP to ${to}. URL: ${inviteUrl}`);
    } else {
      this.logger.warn(`[STAFF_INVITE] Email delivery skipped or failed (${result.error || 'SMTP placeholder'}). Invitation URL: ${inviteUrl}`);
    }
    return { sent: result.success, inviteUrl, isPlaceholder: result.isPlaceholder, error: result.error };
  }

  async createStaff(tenantSlug: string, dto: CreateStaffDto) {
    // 1. Verify tenant exists
    const tenant = await this.resolveTenant(tenantSlug);

    // 2. Ensure TenantRole exists for this tenant
    let tenantRole = await this.prisma.tenantRole.findUnique({
      where: {
        tenantId_role: {
          tenantId: tenant.id,
          role: dto.role,
        },
      },
    });

    if (!tenantRole) {
      tenantRole = await this.prisma.tenantRole.create({
        data: {
          tenantId: tenant.id,
          role: dto.role,
          permissions: (DEFAULT_ROLE_PERMISSIONS[dto.role] || []).map(String),
        },
      });
    }

    // 3. Determine status and invitation
    let status = dto.status || 'ACTIVE';
    let active = dto.active ?? true;
    let inviteToken: string | null = null;
    let invitedAt: Date | null = null;
    let inviteExpiresAt: Date | null = null;

    if (dto.status === 'DRAFT') {
      status = 'DRAFT';
      active = false;
    } else if (dto.email && (dto.sendInvite !== false || dto.status === 'INVITED')) {
      status = 'INVITED';
      active = false;
      inviteToken = crypto.randomUUID();
      invitedAt = new Date();
      inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    // 4. Create staff member in database
    const staff = await this.prisma.staffMember.create({
      data: {
        tenantId: tenant.id,
        roleId: tenantRole.id,
        role: dto.role,
        name: dto.name.trim(),
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        hourlyRate: dto.hourlyRate ?? 0,
        branchIds: dto.branchIds ?? ['all'],
        active,
        status,
        inviteToken,
        invitedAt,
        inviteExpiresAt,
      },
    });

    // 5. Send email if invited
    let emailResult: { sent: boolean; inviteUrl: string; isPlaceholder?: boolean; error?: string } | null = null;
    if (inviteToken && staff.email) {
      emailResult = await this.sendInvitationEmail(
        staff.email,
        staff.name,
        tenant.name,
        staff.role,
        inviteToken,
      );
    }

    return {
      ...staff,
      inviteUrl: emailResult?.inviteUrl || (inviteToken ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite?token=${inviteToken}` : null),
      emailSent: emailResult?.sent || false,
    };
  }

  async getStaffList(tenantSlug: string) {
    const tenant = await this.resolveTenant(tenantSlug);

    return this.prisma.staffMember.findMany({
      where: { tenantId: tenant.id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStaffById(tenantSlug: string, staffId: string) {
    const tenant = await this.resolveTenant(tenantSlug);

    const staff = await this.prisma.staffMember.findFirst({
      where: {
        id: staffId,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff member');
    }

    return staff;
  }

  async updateStaff(
    tenantSlug: string,
    staffId: string,
    dto: UpdateStaffDto,
  ) {
    const tenant = await this.resolveTenant(tenantSlug);

    const existingStaff = await this.prisma.staffMember.findFirst({
      where: {
        id: staffId,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!existingStaff) {
      throw new NotFoundException('Staff member');
    }

    // Ensure restaurant keeps at least one active owner
    if (
      existingStaff.role === UserRole.OWNER &&
      ((dto.role && dto.role !== UserRole.OWNER) || dto.active === false)
    ) {
      const remainingActiveOwners = await this.prisma.staffMember.count({
        where: {
          tenantId: tenant.id,
          role: UserRole.OWNER,
          active: true,
          id: { not: staffId },
        },
      });
      if (remainingActiveOwners === 0) {
        throw new ConflictException(
          'The restaurant must keep at least one active owner.',
        );
      }
    }

    let roleId = existingStaff.roleId;

    // If role is being changed, ensure new TenantRole is referenced
    if (dto.role && dto.role !== existingStaff.role) {
      let newRole = await this.prisma.tenantRole.findUnique({
        where: {
          tenantId_role: {
            tenantId: tenant.id,
            role: dto.role,
          },
        },
      });

      if (!newRole) {
        newRole = await this.prisma.tenantRole.create({
          data: {
            tenantId: tenant.id,
            role: dto.role,
            permissions: (DEFAULT_ROLE_PERMISSIONS[dto.role] || []).map(String),
          },
        });
      }
      roleId = newRole.id;
    }

    const updated = await this.prisma.staffMember.update({
      where: { id: staffId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.role !== undefined && { role: dto.role, roleId }),
        ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.hourlyRate !== undefined && { hourlyRate: dto.hourlyRate }),
        ...(dto.branchIds !== undefined && { branchIds: dto.branchIds }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });

    return updated;
  }

  async deleteStaff(tenantSlug: string, staffId: string) {
    const tenant = await this.resolveTenant(tenantSlug);

    const existingStaff = await this.prisma.staffMember.findFirst({
      where: {
        id: staffId,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!existingStaff) {
      throw new NotFoundException('Staff member');
    }

    if (existingStaff.role === UserRole.OWNER) {
      const remainingActiveOwners = await this.prisma.staffMember.count({
        where: {
          tenantId: tenant.id,
          role: UserRole.OWNER,
          active: true,
          isDeleted: false,
          id: { not: staffId },
        },
      });
      if (remainingActiveOwners === 0) {
        throw new ConflictException(
          'The restaurant must keep at least one active owner.',
        );
      }
    }

    await this.prisma.staffMember.update({
      where: { id: staffId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        active: false,
      },
    });

    return { id: staffId, success: true, message: 'Staff member removed successfully' };
  }

  async reinviteStaff(tenantSlug: string, staffId: string) {
    const tenant = await this.resolveTenant(tenantSlug);
    const staff = await this.prisma.staffMember.findFirst({
      where: {
        id: staffId,
        tenantId: tenant.id,
        isDeleted: false,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff member');
    }

    if (!staff.email) {
      throw new ConflictException('Staff member does not have an email address');
    }

    const inviteToken = crypto.randomUUID();
    const updated = await this.prisma.staffMember.update({
      where: { id: staffId },
      data: {
        status: 'INVITED',
        active: false,
        inviteToken,
        invitedAt: new Date(),
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const emailResult = await this.sendInvitationEmail(
      staff.email,
      staff.name,
      tenant.name,
      staff.role,
      inviteToken,
    );

    return {
      success: true,
      message: emailResult.sent
        ? `Invitation email sent to ${staff.email}`
        : `Invitation created! URL: ${emailResult.inviteUrl}`,
      inviteToken,
      inviteUrl: emailResult.inviteUrl,
      emailSent: emailResult.sent,
      staff: updated,
    };
  }

  async getInviteDetails(token: string) {
    const staff = await this.prisma.staffMember.findFirst({
      where: {
        inviteToken: token,
        isDeleted: false,
      },
      include: {
        tenant: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Invitation');
    }

    if (staff.inviteExpiresAt && staff.inviteExpiresAt < new Date()) {
      throw new ConflictException('This invitation link has expired. Please ask your manager to send a new invite.');
    }

    return {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      tenantName: staff.tenant.name,
      tenantSlug: staff.tenant.slug,
    };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const staff = await this.prisma.staffMember.findFirst({
      where: {
        inviteToken: dto.token,
        isDeleted: false,
      },
      include: {
        tenant: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Invitation');
    }

    if (staff.inviteExpiresAt && staff.inviteExpiresAt < new Date()) {
      throw new ConflictException('This invitation link has expired. Please ask your manager to send a new invite.');
    }

    const email = staff.email?.toLowerCase().trim();
    if (!email) {
      throw new ConflictException('No email address associated with this staff invitation.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create or update User
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          role: staff.role,
          status: UserStatus.ACTIVE,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: staff.role,
          status: UserStatus.ACTIVE,
        },
      });
    }

    // Update staff member
    const updatedStaff = await this.prisma.staffMember.update({
      where: { id: staff.id },
      data: {
        userId: user.id,
        status: 'ACTIVE',
        active: true,
        name: dto.name?.trim() || staff.name,
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });

    return {
      success: true,
      message: 'Invitation accepted successfully! You can now sign in with your email and password.',
      staff: updatedStaff,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      tenant: {
        id: staff.tenant.id,
        name: staff.tenant.name,
        slug: staff.tenant.slug,
      },
    };
  }
}

