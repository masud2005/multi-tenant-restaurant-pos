import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthPasswordController } from './controllers/password.controller';
import { PasswordService } from './services/password.service';
import { JwtStrategy } from '../../common/strategies/jwt.strategy';
import { EmailService } from '../../shared/mail/email-service';
import { StaffModule } from '../staff/staff.module';

@Module({
  imports: [
    PrismaModule,
    StaffModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.accessSecret') as string,
        signOptions: {
          expiresIn: configService.get<string>('jwt.accessTokenExpiresIn') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, AuthPasswordController],
  providers: [AuthService, PasswordService, JwtStrategy, EmailService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
