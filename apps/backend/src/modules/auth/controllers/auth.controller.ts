import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
    ThrottleLogin,
    ThrottleRefreshToken,
} from '../../../common/decorators/throttle.decorator';
import { LoginDto } from '../dto/login.dto';
import { AuthService } from '../services/auth.service';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { StaffService } from '../../staff/staff.service';
import { AcceptInviteDto } from '../../staff/dto/accept-invite.dto';
import { ResponseHelper } from '../../../common/helpers/response.helper';

@ApiTags('(Auth) Account')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly staffService: StaffService,
    ) { }

    @Post('login')
    @ThrottleLogin()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Verify login credentials and direct login',
    })
    @ApiResponse({ status: 200, description: 'User successfully logged in' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('refresh-token')
    @ThrottleRefreshToken()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get new access token using refresh token' })
    @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
    @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
    async refreshToken(@Body() dto: RefreshTokenDto) {
        return this.authService.refreshToken(dto);
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Logout user and invalidate refresh token' })
    @ApiResponse({ status: 200, description: 'User successfully logged out' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async logout(@CurrentUser() user: any) {
        return this.authService.logout(user.id);
    }

    @Get('invite/:token')
    @ApiOperation({ summary: 'Get invitation details by token (Public)' })
    @ApiResponse({ status: 200, description: 'Invitation details retrieved' })
    @ApiResponse({ status: 404, description: 'Invitation not found' })
    async getInviteDetails(@Param('token') token: string) {
        const details = await this.staffService.getInviteDetails(token);
        return ResponseHelper.success(details, 'Invitation details retrieved');
    }

    @Post('accept-invite')
    @ApiOperation({ summary: 'Accept invitation and set password (Public)' })
    @ApiResponse({ status: 200, description: 'Invitation accepted and account activated' })
    async acceptInvite(@Body() dto: AcceptInviteDto) {
        const result = await this.staffService.acceptInvite(dto);
        try {
            if (result.staff?.email) {
                const loginRes = await this.authService.login({
                    email: result.staff.email,
                    password: dto.password,
                });
                return ResponseHelper.success(
                    {
                        ...result,
                        tokens: loginRes.data,
                    },
                    result.message,
                );
            }
        } catch {
            // If auto-login fails, return the regular accept result
        }
        return ResponseHelper.success(result, result.message);
    }
}