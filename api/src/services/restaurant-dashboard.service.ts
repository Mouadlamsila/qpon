import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { campaignStatusEnum, couponCodeStatusEnum, offerClaimStatusEnum, offerPublicationStatusEnum, statusEnum } from '../enums';
import { OfferClaim } from '../entities/offer-claim.entity';
import { Redemption } from '../entities/redemption.entity';
import { RestaurantOffer } from '../entities/restaurant-offer.entity';

export interface RestaurantOfferMetrics {
  claimCount: number;
  redemptionCount: number;
  redemptionRate: number;
}

export interface RestaurantDashboardRedemption {
  redemptionId: string;
  offerTitle: string;
  claimCode: string | null;
  customerEmail: string | null;
  baseOrderValue: number;
  discount: number;
  redeemedAt: Date;
  redeemedBy: string | null;
}

export interface RestaurantOfferActivity {
  type: 'claim' | 'redemption';
  claimCode: string;
  customerEmail: string | null;
  claimStatus: offerClaimStatusEnum;
  claimedAt: Date;
  redeemedAt: Date | null;
  discount: number | null;
  redeemedBy: string | null;
}

@Injectable()
export class RestaurantDashboardService {
  constructor(
    @InjectRepository(RestaurantOffer)
    private readonly offerRepository: Repository<RestaurantOffer>,
    @InjectRepository(OfferClaim)
    private readonly claimRepository: Repository<OfferClaim>,
    @InjectRepository(Redemption)
    private readonly redemptionRepository: Repository<Redemption>,
  ) {}

  async getDashboard(organizationId: string) {
    const [activeOffers, totalClaims, totalRedemptions, todaysRedemptions] = await Promise.all([
      this.countActiveOffers(organizationId),
      this.claimRepository.count({ where: { organization: { organizationId } } }),
      this.countClaimBackedRedemptions(organizationId),
      this.countTodaysClaimBackedRedemptions(organizationId),
    ]);

    const recentRedemptions = await this.getRecentRedemptions(organizationId, 5);
    const bestPerformingOffer = await this.getBestPerformingOffer(organizationId);

    return {
      stats: {
        activeOffers,
        totalClaims,
        totalRedemptions,
        todaysRedemptions,
        redemptionRate: totalClaims === 0
          ? 0
          : Number(((totalRedemptions / totalClaims) * 100).toFixed(2)),
      },
      recentRedemptions,
      bestPerformingOffer,
    };
  }

  async getOfferMetrics(organizationId: string, offerIds: string[]) {
    const metrics = new Map<string, RestaurantOfferMetrics>();
    if (offerIds.length === 0) return metrics;

    const claimRows = await this.claimRepository
      .createQueryBuilder('claim')
      .select('claim.restaurant_offer_id', 'offerId')
      .addSelect('COUNT(claim.claim_id)', 'count')
      .where('claim.organization_id = :organizationId', { organizationId })
      .andWhere('claim.restaurant_offer_id IN (:...offerIds)', { offerIds })
      .groupBy('claim.restaurant_offer_id')
      .getRawMany<{ offerId: string; count: string }>();

    const redemptionRows = await this.redemptionRepository
      .createQueryBuilder('redemption')
      .innerJoin(OfferClaim, 'claim', 'claim.claim_id = redemption.offer_claim_id')
      .select('claim.restaurant_offer_id', 'offerId')
      .addSelect('COUNT(redemption.redemption_id)', 'count')
      .where('redemption.organization_id = :organizationId', { organizationId })
      .andWhere('redemption.offer_claim_id IS NOT NULL')
      .andWhere('claim.organization_id = :organizationId', { organizationId })
      .andWhere('claim.restaurant_offer_id IN (:...offerIds)', { offerIds })
      .groupBy('claim.restaurant_offer_id')
      .getRawMany<{ offerId: string; count: string }>();

    const redemptionsByOffer = new Map(redemptionRows.map((row) => [row.offerId, Number(row.count)]));
    for (const row of claimRows) {
      const claimCount = Number(row.count);
      const redemptionCount = redemptionsByOffer.get(row.offerId) ?? 0;
      metrics.set(row.offerId, {
        claimCount,
        redemptionCount,
        redemptionRate: claimCount === 0 ? 0 : Number(((redemptionCount / claimCount) * 100).toFixed(2)),
      });
    }

    for (const offerId of offerIds) {
      if (!metrics.has(offerId)) {
        metrics.set(offerId, { claimCount: 0, redemptionCount: 0, redemptionRate: 0 });
      }
    }
    return metrics;
  }

  async getOfferActivity(organizationId: string, offerId: string, take = 20) {
    const offer = await this.offerRepository.findOne({
      where: { offerId, organization: { organizationId } },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    const rows = await this.claimRepository
      .createQueryBuilder('claim')
      .leftJoin('claim.customer', 'customer')
      .leftJoin('claim.redemption', 'redemption')
      .leftJoin('redemption.redeemedBy', 'operator')
      .select('claim.display_code', 'claimCode')
      .addSelect('customer.email', 'customerEmail')
      .addSelect('claim.status', 'claimStatus')
      .addSelect('claim.claimed_at', 'claimedAt')
      .addSelect('redemption.redeemed_at', 'redeemedAt')
      .addSelect('redemption.discount', 'discount')
      .addSelect('operator.name', 'redeemedBy')
      .where('claim.organization_id = :organizationId', { organizationId })
      .andWhere('claim.restaurant_offer_id = :offerId', { offerId })
      .orderBy('claim.claimed_at', 'DESC')
      .take(Math.min(Math.max(take, 1), 50))
      .getRawMany();

    return rows.map((row: any): RestaurantOfferActivity => ({
      type: row.redeemedAt ? 'redemption' : 'claim',
      claimCode: row.claimCode,
      customerEmail: row.customerEmail ?? null,
      claimStatus: row.claimStatus,
      claimedAt: new Date(row.claimedAt),
      redeemedAt: row.redeemedAt ? new Date(row.redeemedAt) : null,
      discount: row.discount == null ? null : Number(row.discount),
      redeemedBy: row.redeemedBy ?? null,
    }));
  }

  private async countActiveOffers(organizationId: string) {
    const row = await this.offerRepository
      .createQueryBuilder('offer')
      .innerJoin('offer.coupon', 'coupon')
      .innerJoin('coupon.couponCodes', 'couponCode')
      .innerJoin('couponCode.campaign', 'campaign')
      .select('COUNT(DISTINCT offer.offer_id)', 'count')
      .where('offer.organization_id = :organizationId', { organizationId })
      .andWhere('offer.publication_status = :published', { published: offerPublicationStatusEnum.PUBLISHED })
      .andWhere('coupon.status = :couponStatus', { couponStatus: statusEnum.ACTIVE })
      .andWhere('campaign.status = :campaignStatus', { campaignStatus: campaignStatusEnum.ACTIVE })
      .andWhere('couponCode.status = :codeStatus', { codeStatus: couponCodeStatusEnum.ACTIVE })
      .andWhere('(couponCode.expires_at IS NULL OR couponCode.expires_at > CURRENT_TIMESTAMP)')
      .andWhere('(couponCode.max_redemptions IS NULL OR couponCode.redemption_count < couponCode.max_redemptions)')
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  private async countClaimBackedRedemptions(organizationId: string) {
    return this.redemptionRepository
      .createQueryBuilder('redemption')
      .where('redemption.organization_id = :organizationId', { organizationId })
      .andWhere('redemption.offer_claim_id IS NOT NULL')
      .getCount();
  }

  private async countTodaysClaimBackedRedemptions(organizationId: string) {
    return this.redemptionRepository
      .createQueryBuilder('redemption')
      .where('redemption.organization_id = :organizationId', { organizationId })
      .andWhere('redemption.offer_claim_id IS NOT NULL')
      .andWhere('redemption.redemption_date = CURRENT_DATE')
      .getCount();
  }

  private async getBestPerformingOffer(organizationId: string) {
    const row = await this.redemptionRepository
      .createQueryBuilder('redemption')
      .innerJoin(OfferClaim, 'claim', 'claim.claim_id = redemption.offer_claim_id')
      .innerJoin(RestaurantOffer, 'offer', 'offer.offer_id = claim.restaurant_offer_id')
      .select('offer.offer_id', 'offerId')
      .addSelect('offer.title', 'title')
      .addSelect('COUNT(redemption.redemption_id)', 'redemptions')
      .where('redemption.organization_id = :organizationId', { organizationId })
      .andWhere('redemption.offer_claim_id IS NOT NULL')
      .andWhere('claim.organization_id = :organizationId', { organizationId })
      .andWhere('offer.organization_id = :organizationId', { organizationId })
      .groupBy('offer.offer_id')
      .addGroupBy('offer.title')
      .orderBy('COUNT(redemption.redemption_id)', 'DESC')
      .addOrderBy('offer.title', 'ASC')
      .limit(1)
      .getRawOne<{ offerId: string; title: string; redemptions: string }>();

    return row
      ? { offerId: row.offerId, title: row.title, redemptions: Number(row.redemptions) }
      : null;
  }

  private async getRecentRedemptions(organizationId: string, take: number) {
    const rows = await this.redemptionRepository
      .createQueryBuilder('redemption')
      .innerJoin('redemption.offerClaim', 'claim')
      .innerJoin('claim.restaurantOffer', 'offer')
      .leftJoin('redemption.customer', 'customer')
      .leftJoin('redemption.redeemedBy', 'operator')
      .select('redemption.redemption_id', 'redemptionId')
      .addSelect('offer.title', 'offerTitle')
      .addSelect('claim.display_code', 'claimCode')
      .addSelect('customer.email', 'customerEmail')
      .addSelect('redemption.base_order_value', 'baseOrderValue')
      .addSelect('redemption.discount', 'discount')
      .addSelect('redemption.redeemed_at', 'redeemedAt')
      .addSelect('operator.name', 'redeemedBy')
      .where('redemption.organization_id = :organizationId', { organizationId })
      .andWhere('redemption.offer_claim_id IS NOT NULL')
      .andWhere('claim.organization_id = :organizationId', { organizationId })
      .andWhere('offer.organization_id = :organizationId', { organizationId })
      .orderBy('redemption.redeemed_at', 'DESC')
      .take(Math.min(Math.max(take, 1), 50))
      .getRawMany();

    return rows.map((row: any): RestaurantDashboardRedemption => ({
      redemptionId: row.redemptionId,
      offerTitle: row.offerTitle,
      claimCode: row.claimCode ?? null,
      customerEmail: row.customerEmail ?? null,
      baseOrderValue: Number(row.baseOrderValue),
      discount: Number(row.discount),
      redeemedAt: new Date(row.redeemedAt),
      redeemedBy: row.redeemedBy ?? null,
    }));
  }
}
