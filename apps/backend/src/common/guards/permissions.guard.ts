import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, DEFAULT_ROLE_PERMISSIONS } from '../constants/permissions.constant';
import { UserRole } from '../../../prisma/generated/client';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<(Permission | string)[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no specific permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Owner has unrestricted access
    if (user.role === UserRole.OWNER) {
      return true;
    }

    // Identify tenant from route params, headers, or query
    const tenantSlug =
      request.params?.tenantSlug ||
      request.headers?.['x-tenant-slug'] ||
      request.query?.tenantSlug;

    const tenantId =
      request.params?.tenantId ||
      request.headers?.['x-tenant-id'] ||
      request.query?.tenantId;

    let grantedPermissions: string[] = [];

    if (tenantSlug || tenantId) {
      // Fetch dynamic role permissions configured by the owner for this tenant
      const tenantRole = await this.prisma.tenantRole.findFirst({
        where: {
          role: user.role,
          tenant: tenantSlug
            ? { slug: String(tenantSlug) }
            : { id: String(tenantId) },
        },
      });

      if (tenantRole) {
        grantedPermissions = tenantRole.permissions;
      } else {
        // Fallback to default role permissions matrix if not customized yet
        grantedPermissions = (DEFAULT_ROLE_PERMISSIONS[user.role as UserRole] || []).map(String);
      }

      // Check optional staff-specific custom permissions override and custom role
      if (user.id) {
        const staffMember = await this.prisma.staffMember.findFirst({
          where: {
            userId: user.id,
            tenant: tenantSlug
              ? { slug: String(tenantSlug) }
              : { id: String(tenantId) },
          },
          include: {
            customRole: true,
          },
        });

        if (staffMember?.customRole?.permissions?.length) {
          grantedPermissions = Array.from(
            new Set([...grantedPermissions, ...staffMember.customRole.permissions]),
          );
        }

        if (staffMember?.customPermissions?.length) {
          grantedPermissions = Array.from(
            new Set([...grantedPermissions, ...staffMember.customPermissions]),
          );
        }
      }
    } else {
      // Fallback if request has no tenant context
      grantedPermissions = (DEFAULT_ROLE_PERMISSIONS[user.role as UserRole] || []).map(String);
    }

    // Verify all required permissions are granted
    const hasAll = requiredPermissions.every((perm) =>
      grantedPermissions.includes(String(perm)),
    );

    if (!hasAll) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: [${requiredPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}
