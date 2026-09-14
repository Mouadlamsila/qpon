export interface OfferClaimValidation {
  valid: boolean;
  canRedeem: boolean;
  state: string;
  message: string;
  orderAmountRequired?: boolean;
  minimumAmount?: number | null;
  discount?: number | null;
  claim?: {
    displayCode: string;
    customerEmail: string | null;
    customerName: string | null;
    offerTitle: string | null;
    expiresAt: string;
    redeemedAt: string | null;
  } | null;
}

export interface OfferClaimRedemption {
  redemptionId: string;
  claimCode: string | null;
  offerTitle: string | null;
  customerEmail: string | null;
  baseOrderValue: number;
  discount: number;
  redeemedAt: string;
  redeemedBy: string | null;
}

export interface OfferRedemptionsPage {
  rows: OfferClaimRedemption[];
  count: number;
  skip: number;
  take: number;
}
