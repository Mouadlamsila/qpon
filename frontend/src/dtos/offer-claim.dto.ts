import { PublicRestaurantOfferDto } from './restaurant-offer.dto';

export type OfferClaimStatus = 'claimed' | 'expired' | 'revoked' | 'redeemed';

export interface PublicOfferClaimDto {
  offer: PublicRestaurantOfferDto;
  displayCode: string;
  status: OfferClaimStatus;
  claimedAt: string;
  expiresAt: string;
  claimUrl: string;
}
