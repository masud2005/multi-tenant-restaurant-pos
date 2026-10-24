import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLoyaltySettingsDto {
  @ApiPropertyOptional({
    description: 'Enable or disable loyalty program for this restaurant',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Amount spent in currency (BDT) to earn 1 point (e.g. 100 BDT = 1 point)',
    example: 100,
    minimum: 1,
  })
  @IsNumber({}, { message: 'spendAmountPerPoint must be a number' })
  @Min(1, { message: 'spendAmountPerPoint must be at least 1' })
  @IsOptional()
  spendAmountPerPoint?: number;

  @ApiPropertyOptional({
    description: 'Redemption value in currency (BDT) for 1 loyalty point (e.g. 1 point = 1 BDT)',
    example: 1.0,
    minimum: 0.01,
  })
  @IsNumber({}, { message: 'pointValue must be a number' })
  @Min(0.01, { message: 'pointValue must be greater than 0' })
  @IsOptional()
  pointValue?: number;

  @ApiPropertyOptional({
    description: 'Minimum points a customer must accumulate before they can redeem',
    example: 10,
    minimum: 0,
  })
  @IsInt({ message: 'minPointsToRedeem must be an integer' })
  @Min(0, { message: 'minPointsToRedeem cannot be negative' })
  @IsOptional()
  minPointsToRedeem?: number;

  @ApiPropertyOptional({
    description: 'Maximum points allowed to be redeemed in a single order (optional limit)',
    example: 500,
  })
  @IsInt({ message: 'maxPointsPerOrder must be an integer' })
  @Min(1, { message: 'maxPointsPerOrder must be at least 1' })
  @IsOptional()
  maxPointsPerOrder?: number;

  @ApiPropertyOptional({
    description: 'Points expiry duration in days (optional)',
    example: 365,
  })
  @IsInt({ message: 'expireAfterDays must be an integer' })
  @Min(1, { message: 'expireAfterDays must be at least 1' })
  @IsOptional()
  expireAfterDays?: number;
}
