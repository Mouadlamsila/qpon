import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { RestaurantOffer } from '../entities/restaurant-offer.entity';
import { OfferClaim } from '../entities/offer-claim.entity';
import { Redemption } from '../entities/redemption.entity';
import { organizationStatusEnum } from '../enums';
import { RestaurantDashboardService } from './restaurant-dashboard.service';

export interface PlatformRestaurantSummary {
  organizationId: string;
  name: string;
  status: organizationStatusEnum;
  currency: string;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: Date;
  offerCount: number;
  claimCount: number;
  redemptionCount: number;
}

@Injectable()
export class PlatformAdminService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(RestaurantOffer)
    private readonly offerRepository: Repository<RestaurantOffer>,
    @InjectRepository(OfferClaim)
    private readonly claimRepository: Repository<OfferClaim>,
    @InjectRepository(Redemption)
    private readonly redemptionRepository: Repository<Redemption>,
    private readonly dashboardService: RestaurantDashboardService,
  ) {}

  async listRestaurants(search?: string): Promise<PlatformRestaurantSummary[]> {
    const query = this.organizationRepository
      .createQueryBuilder('organization')
      .select('organization.organization_id', 'organizationId')
      .addSelect('organization.name', 'name')
      .addSelect('organization.status', 'status')
      .addSelect('organization.currency', 'currency')
      .addSelect('organization.contact_email', 'contactEmail')
      .addSelect('organization.contact_phone', 'contactPhone')
      .addSelect('organization.created_at', 'createdAt')
      .addSelect('(SELECT COUNT(*) FROM restaurant_offer offer WHERE offer.organization_id = organization.organization_id)', 'offerCount')
      .addSelect('(SELECT COUNT(*) FROM offer_claim claim WHERE claim.organization_id = organization.organization_id)', 'claimCount')
      .addSelect('(SELECT COUNT(*) FROM redemption redemption WHERE redemption.organization_id = organization.organization_id AND redemption.offer_claim_id IS NOT NULL)', 'redemptionCount')
      .orderBy('organization.created_at', 'DESC');

    if (search?.trim()) query.where('organization.name ILIKE :search', { search: `%${search.trim()}%` });

    return this.mapSummaries(await query.getRawMany());
  }

  async getRestaurant(organizationId: string) {
    const organization = await this.organizationRepository.findOne({ where: { organizationId } });
    if (!organization) throw new NotFoundException('Restaurant not found');
    const summary = (await this.listRestaurants(organization.name)).find((row) => row.organizationId === organizationId);
    return summary ?? this.mapSummary(organization, 0, 0, 0);
  }

  async setRestaurantStatus(organizationId: string, status: organizationStatusEnum) {
    const result = await this.organizationRepository.update({ organizationId }, { status });
    if (!result.affected) throw new NotFoundException('Restaurant not found');
    return this.getRestaurant(organizationId);
  }

  async listOffers(organizationId: string) {
    await this.ensureRestaurant(organizationId);
    const offers = await this.offerRepository.find({
      where: { organization: { organizationId } },
      relations: { organization: true, coupon: { couponCodes: true } },
      order: { createdAt: 'DESC' },
    });
    const dtos = offers.map((offer) => ({
      offerId: offer.offerId,
      title: offer.title,
      publicSlug: offer.publicSlug,
      publicationStatus: offer.publicationStatus,
      createdAt: offer.createdAt,
    }));
    const metrics = await this.dashboardService.getOfferMetrics(organizationId, dtos.map((offer) => offer.offerId));
    return dtos.map((offer) => ({ ...offer, ...(metrics.get(offer.offerId) ?? { claimCount: 0, redemptionCount: 0, redemptionRate: 0 }) }));
  }

  async listRedemptions(organizationId: string) {
    await this.ensureRestaurant(organizationId);
    return this.redemptionRepository
      .createQueryBuilder('redemption')
      .innerJoinAndSelect('redemption.offerClaim', 'claim')
      .innerJoinAndSelect('claim.restaurantOffer', 'offer')
      .leftJoinAndSelect('redemption.customer', 'customer')
      .leftJoinAndSelect('redemption.redeemedBy', 'operator')
      .where('redemption.organization_id = :organizationId', { organizationId })
      .andWhere('redemption.offer_claim_id IS NOT NULL')
      .orderBy('redemption.redeemed_at', 'DESC')
      .take(100)
      .getMany()
      .then((rows) => rows.map((row) => ({
        redemptionId: row.redemptionId,
        offerTitle: row.offerClaim?.restaurantOffer?.title ?? 'Offer',
        claimCode: row.offerClaim?.displayCode ?? null,
        customerEmail: row.customer?.email ?? null,
        discount: Number(row.discount),
        baseOrderValue: Number(row.baseOrderValue),
        redeemedAt: row.redeemedAt ?? row.createdAt,
        redeemedBy: row.redeemedBy?.name ?? null,
      })));
  }

  private async ensureRestaurant(organizationId: string) {
    const exists = await this.organizationRepository.exists({ where: { organizationId } });
    if (!exists) throw new NotFoundException('Restaurant not found');
  }

  private mapSummaries(rows: any[]) {
    return rows.map((row) => this.mapSummary(row, row.offerCount, row.claimCount, row.redemptionCount));
  }

  private mapSummary(row: any, offerCount: any, claimCount: any, redemptionCount: any): PlatformRestaurantSummary {
    return {
      organizationId: row.organizationId,
      name: row.name,
      status: row.status,
      currency: row.currency,
      contactEmail: row.contactEmail ?? null,
      contactPhone: row.contactPhone ?? null,
      createdAt: row.createdAt,
      offerCount: Number(offerCount ?? 0),
      claimCount: Number(claimCount ?? 0),
      redemptionCount: Number(redemptionCount ?? 0),
    };
  }
}
