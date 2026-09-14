import { RestaurantOfferDto } from './restaurant-offer.dto';

export interface RestaurantDashboardStats {
  activeOffers: number;
  totalClaims: number;
  totalRedemptions: number;
  todaysRedemptions: number;
  redemptionRate: number;
}

export interface RestaurantDashboardRedemption {
  redemptionId: string;
  offerTitle: string;
  claimCode: string | null;
  customerEmail: string | null;
  baseOrderValue: number;
  discount: number;
  redeemedAt: string;
  redeemedBy: string | null;
}

export interface RestaurantBestOffer {
  offerId: string;
  title: string;
  redemptions: number;
}

export interface RestaurantDashboard {
  stats: RestaurantDashboardStats;
  recentRedemptions: RestaurantDashboardRedemption[];
  bestPerformingOffer: RestaurantBestOffer | null;
  offers: RestaurantOfferDto[];
}

export interface RestaurantOfferActivity {
  type: 'claim' | 'redemption';
  claimCode: string;
  customerEmail: string | null;
  claimStatus: 'claimed' | 'expired' | 'revoked' | 'redeemed';
  claimedAt: string;
  redeemedAt: string | null;
  discount: number | null;
  redeemedBy: string | null;
}
