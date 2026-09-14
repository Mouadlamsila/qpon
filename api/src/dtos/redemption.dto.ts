import { Expose } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Equals, IsPositive, Min } from 'class-validator';

export class CreateRedemptionDto {
  @Expose({ name: '@entity' })
  @Equals('org.quicko.qpon.redemption')
  entity = 'org.quicko.qpon.redemption';

  @IsString()
  code: string;

  @Expose({ name: 'base_order_value' })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  baseOrderValue: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  discount?: number;

  @Expose({ name: 'external_customer_id' })
  @IsString()
  externalCustomerId: string;

  @Expose({ name: 'external_item_id' })
  @IsString()
  externalItemId: string;

  @Expose({ name: 'external_id' })
  @IsOptional()
  @IsString()
  externalId?: string;
}
