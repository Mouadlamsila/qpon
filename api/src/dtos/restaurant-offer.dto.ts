import { Expose } from 'class-transformer';
import {
  Equals,
  IsDate,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { discountTypeEnum, offerPublicationStatusEnum } from '../enums';

export class RestaurantOfferDto {
  @Expose({ name: '@entity' })
  @Equals('org.quicko.qpon.restaurant_offer')
  entity = 'org.quicko.qpon.restaurant_offer';

  @Expose({ name: 'offer_id' })
  @IsString()
  offerId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description: string | null;

  @IsOptional()
  @Expose({ name: 'image_url' })
  @IsString()
  imageUrl: string | null;

  @Expose({ name: 'public_slug' })
  @IsString()
  publicSlug: string;

  @Expose({ name: 'publication_status' })
  @IsEnum(offerPublicationStatusEnum)
  publicationStatus: offerPublicationStatusEnum;

  @Expose({ name: 'discount_type' })
  @IsEnum(discountTypeEnum)
  discountType: discountTypeEnum;

  @Expose({ name: 'discount_value' })
  @IsNumber()
  discountValue: number;

  @Expose({ name: 'discount_upto' })
  @IsOptional()
  @IsNumber()
  discountUpto: number | null;

  @Expose({ name: 'minimum_amount' })
  @IsOptional()
  @IsNumber()
  minimumAmount: number | null;

  @Expose({ name: 'valid_until' })
  @IsDate()
  validUntil: Date;

  @Expose({ name: 'max_redemptions' })
  @IsOptional()
  @IsInt()
  maxRedemptions: number | null;

  @Expose({ name: 'max_redemption_per_customer' })
  @IsOptional()
  @IsInt()
  maxRedemptionPerCustomer: number | null;

  @Expose({ name: 'created_at' })
  @IsDate()
  createdAt: Date;

  @Expose({ name: 'updated_at' })
  @IsDate()
  updatedAt: Date;

  @Expose({ name: 'claim_count' })
  @IsInt()
  claimCount?: number;

  @Expose({ name: 'redemption_count' })
  @IsInt()
  redemptionCount?: number;

  @Expose({ name: 'redemption_rate' })
  @IsNumber()
  redemptionRate?: number;
}

export class CreateRestaurantOfferDto {
  @Expose({ name: '@entity' })
  @Equals('org.quicko.qpon.restaurant_offer')
  entity = 'org.quicko.qpon.restaurant_offer';

  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Expose({ name: 'discount_type' })
  @IsEnum(discountTypeEnum)
  discountType: discountTypeEnum;

  @Expose({ name: 'discount_value' })
  @IsNumber()
  @Min(0.01)
  discountValue: number;

  @Expose({ name: 'discount_upto' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountUpto?: number;

  @Expose({ name: 'minimum_amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumAmount?: number;

  @Expose({ name: 'valid_until' })
  @IsDateString()
  validUntil: string;

  @Expose({ name: 'max_redemptions' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @Expose({ name: 'max_redemption_per_customer' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptionPerCustomer?: number;
}

export class UpdateRestaurantOfferDto {
  @Expose({ name: '@entity' })
  @Equals('org.quicko.qpon.restaurant_offer')
  entity = 'org.quicko.qpon.restaurant_offer';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Expose({ name: 'discount_type' })
  @IsOptional()
  @IsEnum(discountTypeEnum)
  discountType?: discountTypeEnum;

  @Expose({ name: 'discount_value' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  discountValue?: number;

  @Expose({ name: 'discount_upto' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountUpto?: number;

  @Expose({ name: 'minimum_amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumAmount?: number;

  @Expose({ name: 'valid_until' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @Expose({ name: 'max_redemptions' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @Expose({ name: 'max_redemption_per_customer' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptionPerCustomer?: number;
}

export class PublicRestaurantOfferDto {
  title: string;
  description: string | null;
  imageUrl: string | null;
  restaurant: {
    name: string;
    logoUrl: string | null;
  };
  discountType: discountTypeEnum;
  discountValue: number;
  discountUpto: number | null;
  minimumAmount: number | null;
  validUntil: Date;
  status: offerPublicationStatusEnum;
  terms: string[];
}
