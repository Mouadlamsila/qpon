import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { OfferClaim } from '../entities/offer-claim.entity';
import { Redemption } from '../entities/redemption.entity';
import { CouponCode } from '../entities/coupon-code.entity';
import { Campaign } from '../entities/campaign.entity';
import { RedemptionsService } from './redemption.service';
import {
  campaignStatusEnum,
  couponCodeStatusEnum,
  offerClaimStatusEnum,
  offerPublicationStatusEnum,
  statusEnum,
} from '../enums';
import { RedeemOfferClaimDto, ValidateOfferClaimDto } from '../dtos';

export type OfferClaimValidationState =
  | 'VALID'
  | 'INVALID_CODE'
  | 'ALREADY_REDEEMED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'OFFER_NOT_PUBLISHED'
  | 'OFFER_PAUSED'
  | 'OFFER_EXPIRED'
  | 'OFFER_ARCHIVED'
  | 'OFFER_EXHAUSTED'
  | 'COUPON_INACTIVE'
  | 'CAMPAIGN_INACTIVE'
  | 'CUSTOMER_INELIGIBLE'
  | 'CUSTOMER_LIMIT_REACHED'
  | 'CAMPAIGN_BUDGET_EXCEEDED';

@Injectable()
export class OfferClaimRedemptionService {
  constructor(
    @InjectRepository(OfferClaim)
    private readonly claimRepository: Repository<OfferClaim>,
    private readonly datasource: DataSource,
    private readonly redemptionsService: RedemptionsService,
  ) {}

  async validate(organizationId: string, body: ValidateOfferClaimDto) {
    const claim = await this.findClaim(this.claimRepository, organizationId, body.claimCode);
    if (!claim) return this.invalidResult('INVALID_CODE');

    const result = await this.evaluateClaim(this.claimRepository.manager, claim, body.baseOrderValue);
    return this.toValidationResult(result);
  }

  async redeem(organizationId: string, body: RedeemOfferClaimDto, userId: string) {
    if (!userId) throw new ConflictException('Authenticated operator is required');

    return this.datasource.transaction(async (manager) => {
      const claim = await this.findClaim(manager.getRepository(OfferClaim), organizationId, body.claimCode, true);
      if (!claim) throw new NotFoundException('Claim code not found');

      if (claim.status === offerClaimStatusEnum.REDEEMED) {
        const existing = claim.redemption;
        if (existing) return this.toRedeemedResult(existing, claim);
        throw new ConflictException('Claim has already been redeemed');
      }

      const evaluation = await this.evaluateClaim(manager, claim, body.baseOrderValue);
      if (!evaluation.valid) this.throwForState(evaluation.state);
      if (body.baseOrderValue == null) {
        throw new BadRequestException('Base order value is required to redeem a claim');
      }

      const code = evaluation.code!;
      const campaign = await manager.findOne(Campaign, {
        where: { campaignId: code.campaign.campaignId, organization: { organizationId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!campaign || campaign.status !== campaignStatusEnum.ACTIVE) {
        throw new ConflictException('Campaign is inactive');
      }

      const discount = this.redemptionsService.calculateDiscount(claim.restaurantOffer.coupon, body.baseOrderValue);
      await this.checkCampaignBudget(manager, campaign, organizationId, discount);

      const externalId = body.idempotencyKey?.trim()
        ? `offer-claim:${claim.claimId}:${body.idempotencyKey.trim()}`
        : `offer-claim:${claim.claimId}`;

      const redemption = manager.create(Redemption, {
        organization: { organizationId },
        offerClaim: { claimId: claim.claimId },
        coupon: { couponId: claim.restaurantOffer.coupon.couponId },
        campaign: { campaignId: code.campaign.campaignId },
        couponCode: { couponCodeId: code.couponCodeId },
        customer: { customerId: claim.customer.customerId },
        baseOrderValue: body.baseOrderValue,
        discount,
        externalId,
        redeemedAt: new Date(),
        redeemedBy: { userId },
      });

      const saved = await manager.save(Redemption, redemption);
      await manager.increment(CouponCode, { couponCodeId: code.couponCodeId }, 'redemptionCount', 1);
      code.redemptionCount = Number(code.redemptionCount || 0) + 1;
      if (code.maxRedemptions != null && code.redemptionCount >= code.maxRedemptions) {
        await manager.update(CouponCode, code.couponCodeId, { status: couponCodeStatusEnum.REDEEMED });
      }
      if (campaign.budget != null) {
        const total = await manager
          .createQueryBuilder(Redemption, 'redemption')
          .select('COALESCE(SUM(redemption.discount), 0)', 'total')
          .where('redemption.campaign_id = :campaignId', { campaignId: campaign.campaignId })
          .andWhere('redemption.organization_id = :organizationId', { organizationId })
          .getRawOne<{ total: string }>();
        if (Number(total?.total ?? 0) >= Number(campaign.budget)) {
          await manager.update(Campaign, campaign.campaignId, { status: campaignStatusEnum.EXHAUSTED });
        }
      }

      await manager.update(OfferClaim, claim.claimId, {
        status: offerClaimStatusEnum.REDEEMED,
        redeemedAt: saved.redeemedAt,
      });

      saved.offerClaim = claim;
      saved.redeemedBy = { userId } as any;
      return this.toRedeemedResult(saved, claim);
    }).catch(async (error) => {
      if ((error as any)?.code === '23505') {
        const existing = await this.findClaim(this.claimRepository, organizationId, body.claimCode);
        if (existing?.status === offerClaimStatusEnum.REDEEMED && existing.redemption) {
          return this.toRedeemedResult(existing.redemption, existing);
        }
      }
      throw error;
    });
  }

  async list(organizationId: string, skip = 0, take = 25) {
    const [rows, count] = await this.claimRepository.manager.getRepository(Redemption)
      .createQueryBuilder('redemption')
      .leftJoinAndSelect('redemption.offerClaim', 'claim')
      .leftJoinAndSelect('claim.restaurantOffer', 'offer')
      .leftJoinAndSelect('redemption.customer', 'customer')
      .leftJoinAndSelect('redemption.redeemedBy', 'operator')
      .where('redemption.organization_id = :organizationId', { organizationId })
      .andWhere('redemption.offer_claim_id IS NOT NULL')
      .orderBy('redemption.redeemedAt', 'DESC')
      .skip(skip)
      .take(Math.min(take, 100))
      .getManyAndCount();

    return {
      rows: rows.map((redemption) => ({
        redemptionId: redemption.redemptionId,
        offerTitle: redemption.offerClaim?.restaurantOffer?.title ?? 'Offer',
        claimCode: redemption.offerClaim?.displayCode ?? null,
        customerName: redemption.customer?.name ?? null,
        customerEmail: redemption.customer?.email ?? null,
        baseOrderValue: Number(redemption.baseOrderValue),
        discount: Number(redemption.discount),
        redeemedAt: redemption.redeemedAt ?? redemption.createdAt,
        redeemedBy: redemption.redeemedBy?.name ?? null,
      })),
      count,
      skip,
      take: Math.min(take, 100),
    };
  }

  private async findClaim(repository: Repository<OfferClaim>, organizationId: string, code: string, lock = false) {
    const builder = repository.createQueryBuilder('claim')
      .leftJoinAndSelect('claim.customer', 'customer')
      .leftJoinAndSelect('claim.restaurantOffer', 'offer')
      .leftJoinAndSelect('offer.organization', 'organization')
      .leftJoinAndSelect('offer.coupon', 'coupon')
      .leftJoinAndSelect('coupon.couponCodes', 'couponCode')
      .leftJoinAndSelect('couponCode.campaign', 'campaign')
      .leftJoinAndSelect('claim.redemption', 'redemption')
      .leftJoinAndSelect('redemption.redeemedBy', 'redeemedBy')
      .where('claim.organization_id = :organizationId', { organizationId })
      .andWhere('claim.code_lookup_value = :code', { code: this.normalizeCode(code) });
    if (lock) builder.setLock('pessimistic_write', undefined, ['claim']);
    return builder.getOne();
  }

  private async evaluateClaim(manager: EntityManager, claim: OfferClaim, baseOrderValue?: number) {
    const offer = claim.restaurantOffer;
    const code = offer?.coupon?.couponCodes?.[0];
    let state: OfferClaimValidationState = 'VALID';

    if (!offer || !code || !offer.coupon) state = 'INVALID_CODE';
    else if (claim.status === offerClaimStatusEnum.REVOKED) state = 'REVOKED';
    else if (claim.status === offerClaimStatusEnum.REDEEMED) state = 'ALREADY_REDEEMED';
    else if (claim.status === offerClaimStatusEnum.EXPIRED || new Date(claim.expiresAt).getTime() <= Date.now()) state = 'EXPIRED';
    else if (offer.publicationStatus === offerPublicationStatusEnum.ARCHIVED) state = 'OFFER_ARCHIVED';
    else if (offer.publicationStatus === offerPublicationStatusEnum.EXPIRED) state = 'OFFER_EXPIRED';
    else if (offer.publicationStatus === offerPublicationStatusEnum.DRAFT) state = 'OFFER_NOT_PUBLISHED';
    else if (offer.publicationStatus === offerPublicationStatusEnum.PAUSED) state = 'OFFER_PAUSED';
    else if (offer.coupon.status !== statusEnum.ACTIVE) state = 'COUPON_INACTIVE';
    else if (code.campaign?.status !== campaignStatusEnum.ACTIVE) state = 'CAMPAIGN_INACTIVE';
    else if (code.status !== couponCodeStatusEnum.ACTIVE) state = code.status === couponCodeStatusEnum.REDEEMED ? 'OFFER_EXHAUSTED' : 'CAMPAIGN_INACTIVE';
    else if (code.expiresAt && new Date(code.expiresAt).getTime() <= Date.now()) state = 'OFFER_EXPIRED';
    else if (code.maxRedemptions != null && Number(code.redemptionCount || 0) >= Number(code.maxRedemptions)) state = 'OFFER_EXHAUSTED';
    else if (claim.customer?.status !== statusEnum.ACTIVE) state = 'CUSTOMER_INELIGIBLE';

    const redeemableState = state === 'VALID' || state === 'OFFER_PAUSED';
    if (redeemableState && code && code.maxRedemptionPerCustomer) {
      const count = await manager.getRepository(Redemption).count({
        where: {
          organization: { organizationId: claim.restaurantOffer.organization.organizationId },
          couponCode: { couponCodeId: code.couponCodeId },
          customer: { customerId: claim.customer.customerId },
        },
      });
      if (count >= code.maxRedemptionPerCustomer) state = 'CUSTOMER_LIMIT_REACHED';
    }

    let discount: number | null = null;
    if (redeemableState && baseOrderValue != null) {
      if (code!.minimumAmount != null && baseOrderValue < Number(code!.minimumAmount)) {
        throw new BadRequestException(`Coupon code eligible for amount greater than ${code!.minimumAmount}`);
      }
      discount = this.redemptionsService.calculateDiscount(offer.coupon, baseOrderValue);
      if (code!.campaign?.budget != null) {
        const current = await manager.getRepository(Redemption)
          .createQueryBuilder('redemption')
          .select('COALESCE(SUM(redemption.discount), 0)', 'total')
          .where('redemption.campaign_id = :campaignId', { campaignId: code!.campaign.campaignId })
          .andWhere('redemption.organization_id = :organizationId', { organizationId: claim.restaurantOffer.organization.organizationId })
          .getRawOne<{ total: string }>();
        if (Number(current?.total ?? 0) + discount > Number(code!.campaign.budget)) state = 'CAMPAIGN_BUDGET_EXCEEDED';
      }
    }

    return { valid: redeemableState, state, claim, code, discount, orderAmountRequired: redeemableState && baseOrderValue == null };
  }

  private toValidationResult(result: any) {
    const { claim, code } = result;
    return {
      valid: result.valid,
      canRedeem: result.valid && !result.orderAmountRequired,
      state: result.state,
      message: result.state === 'OFFER_PAUSED'
        ? 'Offer is paused; this existing claim remains redeemable'
        : this.messageForState(result.state),
      orderAmountRequired: result.orderAmountRequired,
      minimumAmount: code?.minimumAmount == null ? null : Number(code.minimumAmount),
      discount: result.discount,
      claim: result.valid || result.state === 'ALREADY_REDEEMED' ? {
        displayCode: claim.displayCode,
        customerEmail: claim.customer?.email ?? null,
        customerName: claim.customer?.name ?? null,
        offerTitle: claim.restaurantOffer?.title ?? null,
        expiresAt: claim.expiresAt,
        redeemedAt: claim.redeemedAt,
      } : null,
    };
  }

  private toRedeemedResult(redemption: Redemption, claim: OfferClaim) {
    return {
      success: true,
      idempotent: claim.status === offerClaimStatusEnum.REDEEMED,
      state: 'REDEEMED',
      message: 'Claim redeemed successfully',
      redemption: {
        redemptionId: redemption.redemptionId,
        claimCode: claim.displayCode,
        offerTitle: claim.restaurantOffer?.title ?? null,
        customerEmail: claim.customer?.email ?? null,
        baseOrderValue: Number(redemption.baseOrderValue),
        discount: Number(redemption.discount),
        redeemedAt: redemption.redeemedAt ?? redemption.createdAt,
      },
    };
  }

  private invalidResult(state: OfferClaimValidationState) {
    return { valid: false, canRedeem: false, state, message: this.messageForState(state), claim: null };
  }

  private throwForState(state: OfferClaimValidationState) {
    if (state === 'EXPIRED' || state === 'OFFER_EXPIRED') throw new GoneException(this.messageForState(state));
    if (state === 'INVALID_CODE') throw new NotFoundException(this.messageForState(state));
    throw new ConflictException(this.messageForState(state));
  }

  private messageForState(state: OfferClaimValidationState) {
    const messages: Record<OfferClaimValidationState, string> = {
      VALID: 'Claim is valid', INVALID_CODE: 'Claim code not found', ALREADY_REDEEMED: 'Claim has already been redeemed',
      EXPIRED: 'Claim has expired', REVOKED: 'Claim has been revoked', OFFER_NOT_PUBLISHED: 'Offer is not published',
      OFFER_PAUSED: 'Offer is paused but existing claims remain redeemable', OFFER_EXPIRED: 'Offer has expired',
      OFFER_ARCHIVED: 'Offer is archived', OFFER_EXHAUSTED: 'Offer redemption limit has been reached',
      COUPON_INACTIVE: 'Coupon is inactive', CAMPAIGN_INACTIVE: 'Campaign is inactive',
      CUSTOMER_INELIGIBLE: 'Customer is not eligible', CUSTOMER_LIMIT_REACHED: 'Customer redemption limit has been reached',
      CAMPAIGN_BUDGET_EXCEEDED: 'Campaign budget has been exceeded',
    };
    return messages[state];
  }

  private async checkCampaignBudget(manager: EntityManager, campaign: Campaign, organizationId: string, discount: number) {
    if (campaign.budget == null) return;
    const total = await manager.getRepository(Redemption)
      .createQueryBuilder('redemption')
      .select('COALESCE(SUM(redemption.discount), 0)', 'total')
      .where('redemption.campaign_id = :campaignId', { campaignId: campaign.campaignId })
      .andWhere('redemption.organization_id = :organizationId', { organizationId })
      .getRawOne<{ total: string }>();
    if (Number(total?.total ?? 0) + discount > Number(campaign.budget)) {
      throw new ConflictException('Campaign budget has been exceeded');
    }
  }

  private normalizeCode(code: string) {
    return code.trim().toUpperCase();
  }
}
