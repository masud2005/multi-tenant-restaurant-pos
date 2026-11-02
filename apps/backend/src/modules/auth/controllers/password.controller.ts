import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PasswordService } from '../services/password.service';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ResponseHelper } from '../../../common/helpers/response.helper';

@ApiTags('(Auth) Password')
@Controller('auth')
export class AuthPasswordController {
  constructor(private readonly passwordService: PasswordService) {}

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset link by email (Public)',
    description:
      'Sends a secure password reset link to user email. Returns success message and in non-production environments includes the reset URL for preview.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset request processed',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordService.requestPasswordReset(dto.email);
  }

  @Get('reset-password/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate password reset token (Public)',
    description:
      'Checks whether a password reset token is valid, unexpired, and not yet used.',
  })
  @ApiQuery({
    name: 'token',
    description: 'Password reset token from reset link',
  })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
  })
  @ApiResponse({ status: 400, description: 'Token is invalid or expired' })
  async validateResetToken(@Query('token') token: string) {
    const result = await this.passwordService.validateResetToken(token);
    return ResponseHelper.success(
      { valid: result.valid, email: result.email },
      'Token is valid',
    );
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password using token (Public)',
    description:
      'Sets a new password for the account associated with the valid reset token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password successfully reset',
  })
  @ApiResponse({ status: 400, description: 'Token invalid or expired' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordService.resetPassword(dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for authenticated user' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized or invalid old password',
  })
  async changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.passwordService.changePassword(user.id, dto);
  }
}
