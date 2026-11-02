import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PasswordService } from './password.service';
import { BadRequestException } from '@nestjs/common';
import {
  NotFoundException,
  UnauthorizedException,
} from '../../../common/exceptions/business.exception';
import * as bcrypt from 'bcrypt';

describe('PasswordService - Password Reset Flow', () => {
  let passwordService: PasswordService;
  let mockPrisma: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockEmailService: any;

  const mockUser = {
    id: 'usr_1',
    email: 'chef@restaurant.com',
    password: '$2b$10$existingPasswordHash12345678901234567890',
    status: 'ACTIVE',
    updatedAt: new Date('2026-01-01T10:00:00Z'),
    staffMembers: [{ name: 'Chef Rahman' }],
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    mockJwtService = {
      sign: vi.fn().mockReturnValue('mock-reset-token-xyz'),
      decode: vi.fn(),
      verify: vi.fn(),
    };

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'jwt.accessSecret') return 'test-access-secret';
        if (key === 'FRONTEND_URL') return 'http://localhost:3000';
        return null;
      }),
    };

    mockEmailService = {
      sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-101' }),
    };

    passwordService = new PasswordService(
      mockPrisma,
      mockJwtService,
      mockConfigService,
      mockEmailService,
    );
  });

  describe('requestPasswordReset', () => {
    it('returns generic success message if user does not exist (prevents enumeration)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const res = await passwordService.requestPasswordReset('nonexistent@example.com');

      expect(res.data.emailSent).toBe(false);
      expect(res.data.message).toContain('If an account exists with this email');
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('generates token and sends reset email if user exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const res = await passwordService.requestPasswordReset('chef@restaurant.com');

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          type: 'PASSWORD_RESET',
        }),
        expect.objectContaining({
          secret: `test-access-secret:${mockUser.password}`,
          expiresIn: '1h',
        }),
      );

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        mockUser.email,
        expect.stringContaining('Reset Your Password'),
        expect.stringContaining('mock-reset-token-xyz'),
      );

      expect(res.data.emailSent).toBe(true);
      expect(res.data.token).toBe('mock-reset-token-xyz');
      expect(res.data.resetUrl).toContain('mock-reset-token-xyz');
    });
  });

  describe('validateResetToken', () => {
    it('throws BadRequestException if token is missing or malformed', async () => {
      await expect(passwordService.validateResetToken('')).rejects.toThrow(
        BadRequestException,
      );

      mockJwtService.decode.mockReturnValue(null);
      await expect(passwordService.validateResetToken('invalid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException if user from token does not exist', async () => {
      mockJwtService.decode.mockReturnValue({
        sub: 'usr_missing',
        type: 'PASSWORD_RESET',
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(passwordService.validateResetToken('valid-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnauthorizedException if account is blocked or suspended', async () => {
      mockJwtService.decode.mockReturnValue({
        sub: 'usr_1',
        type: 'PASSWORD_RESET',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: 'BLOCK',
      });

      await expect(passwordService.validateResetToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws BadRequestException if token verification fails (expired or tampered)', async () => {
      mockJwtService.decode.mockReturnValue({
        sub: 'usr_1',
        type: 'PASSWORD_RESET',
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(passwordService.validateResetToken('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns valid: true and email when token is valid', async () => {
      mockJwtService.decode.mockReturnValue({
        sub: 'usr_1',
        type: 'PASSWORD_RESET',
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.verify.mockReturnValue({ sub: 'usr_1' });

      const res = await passwordService.validateResetToken('valid-token');

      expect(res.valid).toBe(true);
      expect(res.email).toBe(mockUser.email);
      expect(res.userId).toBe(mockUser.id);
    });
  });

  describe('resetPassword', () => {
    it('successfully resets password and updates user in database', async () => {
      mockJwtService.decode.mockReturnValue({
        sub: 'usr_1',
        type: 'PASSWORD_RESET',
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.verify.mockReturnValue({ sub: 'usr_1' });
      mockPrisma.user.update.mockResolvedValue({ ...mockUser });

      const res = await passwordService.resetPassword({
        token: 'valid-token',
        newPassword: 'MyNewStrongPassword123!',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            password: expect.any(String),
          }),
        }),
      );

      expect(res.message).toContain('Password has been reset successfully');
    });
  });
});

