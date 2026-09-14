import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import { PublicRestaurantOfferDto } from './restaurant-offer.dto';
import { offerClaimStatusEnum } from '../enums';

export class CreateOfferClaimDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @IsString()
  @MaxLength(254)
  email: string;
}

export class PublicOfferClaimDto {
  offer: PublicRestaurantOfferDto;
  displayCode: string;
  status: offerClaimStatusEnum;
  claimedAt: Date;
  expiresAt: Date;
  claimUrl: string;
}
