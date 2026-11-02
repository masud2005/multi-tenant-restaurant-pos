import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ResponseHelper } from '../../../common/helpers/response.helper';
import { EmailService } from '../../../shared/mail/email-service';
import { baseEmailTemplate } from '../../../shared/mail/templates/base-email.template';
import * as bcrypt from 'bcrypt';
import {
  NotFoundException,
  UnauthorizedException,
} from '../../../common/exceptions/business.exception';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private getResetSecret(userPassword: string | null): string {
    const baseSecret =
      this.configService.get<string>('jwt.accessSecret') ||
      process.env.JWT_ACCESS_SECRET ||
      'pos-jwt-default-secret';
    return `${baseSecret}:${userPassword || ''}`;
  }

  async requestPasswordReset(email: string) {
    const trimmedEmail = email.trim().toLowerCase();

    // 1. Check if user exists
    const user = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: trimmedEmail,
          mode: 'insensitive',
        },
      },
      include: {
        staffMembers: {
          where: { isDeleted: false },
          include: { tenant: true },
        },
      },
    });

    // Security best practice: return success without revealing if email is registered
    if (!user || !user.email) {
      return ResponseHelper.success(
        {
          message:
            'If an account exists with this email, a password reset link has been sent.',
          emailSent: false,
        },
        'Password reset link requested',
      );
    }

    // 2. Generate signed reset token bound to user's current password hash
    const secret = this.getResetSecret(user.password);
    const token = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        type: 'PASSWORD_RESET',
        v: user.updatedAt.getTime(),
      },
      {
        secret,
        expiresIn: '1h',
      },
    );

    // 3. Prepare reset link and email
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    const subject = 'Reset Your Password — Tablewise POS';
    const recipientName = user.staffMembers?.[0]?.name || 'User';

    const content = `
      <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${recipientName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
        We received a request to reset the password for your Tablewise POS account (<strong>${user.email}</strong>).
      </p>
      <p style="font-size: 14px; line-height: 1.5; margin-bottom: 30px;">
        Please click the button below to set a new password:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" class="btn" style="background-color: #7F41F0; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="font-size: 12px; color: #a0a0a0; margin-top: 30px;">
        Or copy and paste this link in your browser:<br/>
        <a href="${resetUrl}" style="color: #9d71ea;">${resetUrl}</a>
      </p>
      <p style="font-size: 12px; color: #a0a0a0;">This link will expire in 1 hour. If you did not request this, you can safely ignore this email.</p>
    `;

    const html = baseEmailTemplate('Password Reset', content);
    const emailResult = await this.emailService.sendEmail(user.email, subject, html);

    if (emailResult.success) {
      this.logger.log(`Password reset email delivered to ${user.email}`);
    } else {
      this.logger.warn(
        `Password reset email not sent via SMTP (${emailResult.error || 'placeholder'}). Reset URL: ${resetUrl}`,
      );
    }

    return ResponseHelper.success(
      {
        message:
          'If an account exists with this email, a password reset link has been sent.',
        emailSent: emailResult.success,
        resetUrl,
        token,
      },
      'Password reset link requested',
    );
  }

  async validateResetToken(token: string) {
    if (!token) {
      throw new BadRequestException('Reset token is required');
    }

    // 1. Decode token to find user
    const decoded: any = this.jwtService.decode(token);
    if (!decoded || !decoded.sub || decoded.type !== 'PASSWORD_RESET') {
      throw new BadRequestException('Invalid or malformed password reset token');
    }

    // 2. Fetch user
    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user) {
      throw new NotFoundException('User');
    }

    if (user.status === 'BLOCK' || user.status === 'SUSPEND') {
      throw new UnauthorizedException('Account is blocked or suspended');
    }

    // 3. Cryptographically verify signature with secret bound to current password
    const secret = this.getResetSecret(user.password);
    try {
      this.jwtService.verify(token, { secret });
    } catch {
      throw new BadRequestException(
        'Password reset link is invalid, expired, or has already been used.',
      );
    }

    return {
      valid: true,
      email: user.email,
      userId: user.id,
      user,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // 1. Verify token
    const { user } = await this.validateResetToken(dto.token);

    // 2. Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    // 3. Update password in database (this changes updatedAt, invalidating token)
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Password successfully reset for user ${user.email}`);
    return ResponseHelper.success(
      null,
      'Password has been reset successfully. You can now sign in with your new password.',
    );
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      throw new NotFoundException('User');
    }

    const isPasswordValid = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid old password');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return ResponseHelper.success(null, 'Password changed successfully');
  }
}
