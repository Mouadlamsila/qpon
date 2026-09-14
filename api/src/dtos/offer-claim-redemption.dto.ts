import { Expose, Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class ValidateOfferClaimDto {
  @Expose({ name: 'claim_code' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  @MaxLength(32)
  claimCode: string;

  @Expose({ name: 'base_order_value' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  baseOrderValue?: number;
}

export class RedeemOfferClaimDto {
  @Expose({ name: 'claim_code' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  @MaxLength(32)
  claimCode: string;

  @Expose({ name: 'base_order_value' })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  baseOrderValue: number;

  @Expose({ name: 'idempotency_key' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
