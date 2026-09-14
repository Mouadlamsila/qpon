import { discountTypeEnum, offerPublicationStatusEnum } from '../enums';

export class RestaurantOfferDto {
  offerId!: string;
  title!: string;
  description!: string | null;
  imageUrl!: string | null;
  publicSlug!: string;
  publicationStatus!: offerPublicationStatusEnum;
  discountType!: discountTypeEnum;
  discountValue!: number;
  discountUpto!: number | null;
  minimumAmount!: number | null;
  validUntil!: string;
  maxRedemptions!: number | null;
  maxRedemptionPerCustomer!: number | null;
  createdAt!: string;
  updatedAt!: string;
  claimCount?: number;
  redemptionCount?: number;
  redemptionRate?: number;
}

export interface CreateRestaurantOfferDto {
  title: string;
  description?: string;
  discountType: discountTypeEnum;
  discountValue: number;
  discountUpto?: number;
  minimumAmount?: number;
  validUntil: string;
  maxRedemptions?: number;
  maxRedemptionPerCustomer?: number;
}

export interface PublicRestaurantOfferDto {
  title: string;
  description: string | null;
  imageUrl: string | null;
  restaurant: { name: string; logoUrl: string | null };
  discountType: discountTypeEnum;
  discountValue: number;
  discountUpto: number | null;
  minimumAmount: number | null;
  validUntil: string;
  status: offerPublicationStatusEnum;
  terms: string[];
}
