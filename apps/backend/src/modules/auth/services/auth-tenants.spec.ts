import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service';
import { UserRole, UserStatus } from '../../../../prisma/generated/client';
import { NotFoundException } from '../../../common/exceptions/business.exception';

describe('AuthService - getMyTenants (Multi-Tenant Workspaces)', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockEventEmitter: any;
  let mockRedisService: any;

  const mockOwnerUser = {
    id: 'usr_owner',
    email: 'owner@tablewise.com',
    role: UserRole.OWNER,
    status: UserStatus.ACTIVE,
  };

  const mockStaffUser = {
    id: 'usr_staff',
    email: 'waiter@saffron.com',
    role: UserRole.WAITER,
    status: UserStatus.ACTIVE,
  };

  const mockTenants = [
    {
      id: 't_saffron',
      slug: 'saffron-ember',
      name: 'Saffron & Ember',
      tagline: 'Charcoal grill & curry house',
      initials: 'SE',
      accent: 'oklch(0.62 0.17 42)',
      currency: 'BDT',
      locale: 'en-BD',
      taxRate: 0.075,
      serviceChargeRate: 0.05,
      receiptFooter: 'Thank you for dining with Saffron & Ember!',
    },
    {
      id: 't_harbor',
      slug: 'harbor-noodle',
      name: 'Harbor Noodle Co.',
      tagline: 'Hand-pulled noodles & bao',
      initials: 'HN',
      accent: 'oklch(0.55 0.11 205)',
      currency: 'BDT',
      locale: 'en-BD',
      taxRate: 0.0875,
      serviceChargeRate: 0,
      receiptFooter: 'Slurp responsibly. See you soon!',
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
      },
      tenant: {
        findMany: vi.fn(),
      },
      staffMember: {
        findMany: vi.fn(),
      },
    };

    mockJwtService = {
      sign: vi.fn(),
      verify: vi.fn(),
    };

    mockConfigService = {
      get: vi.fn(),
    };

    mockEventEmitter = {
      emit: vi.fn(),
    };

    mockRedisService = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };

    authService = new AuthService(
      mockPrisma,
      mockJwtService,
      mockConfigService,
      mockEventEmitter,
      mockRedisService,
    );
  });

  it('throws NotFoundException if user is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(authService.getMyTenants('usr_nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns all tenants with role owner when user is platform OWNER', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockOwnerUser);
    mockPrisma.tenant.findMany.mockResolvedValue(mockTenants);

    const result = await authService.getMyTenants('usr_owner');

    expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('t_saffron');
    expect(result[0].role).toBe('owner');
    expect(result[1].id).toBe('t_harbor');
    expect(result[1].role).toBe('owner');
  });

  it('returns only assigned tenants with specific role for staff members', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockStaffUser);
    mockPrisma.staffMember.findMany.mockResolvedValue([
      {
        id: 'sm_1',
        tenantId: 't_saffron',
        userId: 'usr_staff',
        role: UserRole.WAITER,
        status: 'ACTIVE',
        tenant: mockTenants[0],
      },
    ]);

    const result = await authService.getMyTenants('usr_staff');

    expect(mockPrisma.staffMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isDeleted: false,
          active: true,
        }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t_saffron');
    expect(result[0].name).toBe('Saffron & Ember');
    expect(result[0].role).toBe('waiter');
  });

  it('returns empty array when staff user has no tenant associations', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockStaffUser);
    mockPrisma.staffMember.findMany.mockResolvedValue([]);

    const result = await authService.getMyTenants('usr_staff');

    expect(result).toEqual([]);
  });
});

