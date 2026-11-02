import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { UserRole, UserStatus } from '../../../../prisma/generated/client';
import { ResponseHelper } from '../../../common/helpers/response.helper';
import {
    InvalidCredentialsException,
    NotFoundException,
    UnauthorizedException,
} from '../../../common/exceptions/business.exception';
import { ConfigService } from '@nestjs/config';
import { generateTokens } from '../utils/token.util';
import { RedisService } from '../../../shared/redis/redis.service';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly eventEmitter: EventEmitter2,
        private readonly redisService: RedisService,
    ) { }

    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (!user || !user.password) {
            throw new InvalidCredentialsException();
        }

        const isPasswordValid = await bcrypt.compare(dto.password, user.password);
        if (!isPasswordValid) {
            throw new InvalidCredentialsException();
        }

        if (user.status !== UserStatus.ACTIVE) {
            throw new UnauthorizedException(
                `Your account is currently ${user.status}. Please contact support.`,
            );
        }

        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        this.eventEmitter.emit('activity.log', {
            type: 'USER_LOGIN',
            message: `${user.email} logged in`,
            metadata: { userId: user.id },
        });

        const payload = { sub: user.id, email: user.email, role: user.role };
        const { accessToken, refreshToken } = generateTokens(
            this.jwtService,
            this.configService,
            payload,
        );

        // Store refresh token in Redis (e.g., valid for 30 days => 30 * 24 * 60 * 60)
        const refreshExpiresInStr = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') as string;
        const ttlSeconds = refreshExpiresInStr && refreshExpiresInStr.includes('d')
            ? parseInt(refreshExpiresInStr) * 24 * 60 * 60
            : 30 * 24 * 60 * 60;
        await this.redisService.set(`refresh_token:${user.id}`, refreshToken, ttlSeconds);

        return ResponseHelper.success(
            {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                },
            },
            'Login successful',
        );
    }

    async refreshToken(dto: RefreshTokenDto) {
        try {
            const refreshSecret = this.configService.get<string>('jwt.refreshSecret') as string;
            const decoded = this.jwtService.verify(dto.refreshToken, { secret: refreshSecret });

            // Check if token matches the one in Redis
            const storedToken = await this.redisService.get(`refresh_token:${decoded.sub}`);
            if (!storedToken || storedToken !== dto.refreshToken) {
                throw new UnauthorizedException('Invalid or expired refresh token');
            }

            // Verify user exists and is active
            const user = await this.prisma.user.findUnique({
                where: { id: decoded.sub },
            });
            if (!user || user.status !== UserStatus.ACTIVE) {
                throw new UnauthorizedException('Invalid or expired refresh token');
            }

            // Generate a new token pair
            const payload = {
                sub: user.id,
                email: user.email,
                role: user.role,
            };
            const { accessToken, refreshToken } = generateTokens(
                this.jwtService,
                this.configService,
                payload,
            );

            // Update refresh token in Redis
            const refreshExpiresInStr = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') as string;
            const ttlSeconds = refreshExpiresInStr && refreshExpiresInStr.includes('d')
                ? parseInt(refreshExpiresInStr) * 24 * 60 * 60
                : 30 * 24 * 60 * 60;
            await this.redisService.set(`refresh_token:${user.id}`, refreshToken, ttlSeconds);

            return ResponseHelper.success(
                { accessToken, refreshToken },
                'Token refreshed successfully',
            );
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }

    async logout(userId: string) {
        await this.redisService.del(`refresh_token:${userId}`);

        // Invalidate current access tokens by storing a logout timestamp (TTL: 15 mins)
        await this.redisService.set(`user_logout:${userId}`, Date.now().toString(), 15 * 60);

        this.eventEmitter.emit('activity.log', {
            type: 'USER_LOGOUT',
            message: `User logged out`,
            metadata: { userId },
        });

        return ResponseHelper.success(null, 'Logged out successfully');
    }


    async getMyTenants(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                staffMembers: {
                    where: {
                        isDeleted: false,
                        active: true,
                    },
                    include: {
                        tenant: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('User');
        }

        // Platform OWNER has access to all tenants across the workspace
        if (user.role === UserRole.OWNER) {
            const allTenants = await this.prisma.tenant.findMany({
                orderBy: { name: 'asc' },
            });

            return allTenants.map((t) => ({
                id: t.id,
                slug: t.slug,
                name: t.name,
                tagline: t.tagline || '',
                initials: t.initials || '',
                accent: t.accent || 'oklch(0.6 0.2 240)',
                currency: t.currency,
                locale: t.locale,
                taxRate: t.taxRate,
                serviceChargeRate: t.serviceChargeRate,
                receiptFooter: t.receiptFooter || '',
                role: 'owner',
                status: 'ACTIVE',
            }));
        }

        // For staff members, find tenants by direct staff link or email matching
        const staffRecords = await this.prisma.staffMember.findMany({
            where: {
                OR: [
                    { userId: user.id },
                    ...(user.email ? [{ email: { equals: user.email, mode: 'insensitive' as const } }] : []),
                ],
                isDeleted: false,
                active: true,
            },
            include: {
                tenant: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        const tenantMap = new Map<string, any>();
        for (const record of staffRecords) {
            if (record.tenant && !tenantMap.has(record.tenant.id)) {
                tenantMap.set(record.tenant.id, {
                    id: record.tenant.id,
                    slug: record.tenant.slug,
                    name: record.tenant.name,
                    tagline: record.tenant.tagline || '',
                    initials: record.tenant.initials || '',
                    accent: record.tenant.accent || 'oklch(0.6 0.2 240)',
                    currency: record.tenant.currency,
                    locale: record.tenant.locale,
                    taxRate: record.tenant.taxRate,
                    serviceChargeRate: record.tenant.serviceChargeRate,
                    receiptFooter: record.tenant.receiptFooter || '',
                    role: record.role ? record.role.toLowerCase() : 'waiter',
                    status: record.status || 'ACTIVE',
                });
            }
        }

        return Array.from(tenantMap.values());
    }
}
