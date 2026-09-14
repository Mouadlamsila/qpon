import { OrganizationStatus } from '../enums';

export interface PlatformRestaurantSummary {
  organizationId: string;
  name: string;
  status: OrganizationStatus;
  currency: string;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  offerCount: number;
  claimCount: number;
  redemptionCount: number;
}

export interface PlatformRestaurantOffer {
  offerId: string;
  title: string;
  publicSlug: string;
  publicationStatus: string;
  createdAt: string;
  claimCount: number;
  redemptionCount: number;
  redemptionRate: number;
}
