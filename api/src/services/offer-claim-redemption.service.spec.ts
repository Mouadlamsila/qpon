import { OfferClaimRedemptionService } from './offer-claim-redemption.service';
import {
  campaignStatusEnum,
  couponCodeStatusEnum,
  discountTypeEnum,
  offerClaimStatusEnum,
  offerPublicationStatusEnum,
  statusEnum,
} from '../enums';

describe('OfferClaimRedemptionService', () => {
  const org = { organizationId: 'org-1' } as any;
  const customer = { customerId: 'customer-1', email: 'customer@example.com', name: null, status: statusEnum.ACTIVE } as any;
  const campaign = { campaignId: 'campaign-1', status: campaignStatusEnum.ACTIVE, budget: null } as any;
  const coupon = { couponId: 'coupon-1', status: statusEnum.ACTIVE, discountType: discountTypeEnum.PERCENTAGE, discountValue: 20, discountUpto: null } as any;
  const code = { couponCodeId: 'code-1', status: couponCodeStatusEnum.ACTIVE, expiresAt: new Date(Date.now() + 3600000), redemptionCount: 0, maxRedemptions: null, maxRedemptionPerCustomer: null, minimumAmount: null, campaign, coupon } as any;
  const offer = { offerId: 'offer-1', title: 'Dinner offer', publicationStatus: offerPublicationStatusEnum.PUBLISHED, organization: org, coupon: { ...coupon, couponCodes: [code] } } as any;
  const claim = { claimId: 'claim-1', displayCode: 'QP-ABC', codeLookupValue: 'QP-ABC', status: offerClaimStatusEnum.CLAIMED, claimedAt: new Date(), expiresAt: new Date(Date.now() + 3600000), redeemedAt: null, restaurantOffer: offer, customer, organization: org, redemption: null } as any;

  let queryBuilder: any;
  let claimRepository: any;
  let manager: any;
  let service: OfferClaimRedemptionService;

  beforeEach(() => {
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(claim),
    };
    claimRepository = { createQueryBuilder: jest.fn(() => queryBuilder), manager: null };
    const redemptionRepository = {
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      })),
    };
    manager = {
      getRepository: jest.fn((entity) => entity.name === 'Redemption' ? redemptionRepository : claimRepository),
    };
    claimRepository.manager = manager;
    service = new OfferClaimRedemptionService(claimRepository, {} as any, { calculateDiscount: jest.fn().mockReturnValue(20) } as any);
  });

  it('normalizes the merchant code and returns a valid tenant-scoped claim', async () => {
    const result = await service.validate('org-1', { claimCode: ' qp-abc ' } as any);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('claim.code_lookup_value = :code', { code: 'QP-ABC' });
    expect(result.valid).toBe(true);
    expect(result.claim?.customerEmail).toBe('customer@example.com');
  });

  it('does not reveal a claim when the organization lookup has no match', async () => {
    queryBuilder.getOne.mockResolvedValue(undefined);

    const result = await service.validate('other-org', { claimCode: 'QP-ABC' } as any);

    expect(result).toMatchObject({ valid: false, canRedeem: false, state: 'INVALID_CODE', claim: null });
  });

  it.each([
    [offerClaimStatusEnum.REVOKED, offerPublicationStatusEnum.PUBLISHED, 'REVOKED'],
    [offerClaimStatusEnum.EXPIRED, offerPublicationStatusEnum.PUBLISHED, 'EXPIRED'],
    [offerClaimStatusEnum.CLAIMED, offerPublicationStatusEnum.ARCHIVED, 'OFFER_ARCHIVED'],
  ])('returns the explicit invalid state for %s/%s', async (claimStatus, publicationStatus, expected) => {
    claim.status = claimStatus;
    offer.publicationStatus = publicationStatus;
    const result = await service.validate('org-1', { claimCode: 'QP-ABC' } as any);
    expect(result.state).toBe(expected);
    claim.status = offerClaimStatusEnum.CLAIMED;
    offer.publicationStatus = offerPublicationStatusEnum.PUBLISHED;
  });

  it('allows an existing claim on a paused offer and keeps redemption in the transaction path', async () => {
    offer.publicationStatus = offerPublicationStatusEnum.PAUSED;
    const result = await service.validate('org-1', { claimCode: 'QP-ABC', baseOrderValue: 100 } as any);
    expect(result).toMatchObject({ valid: true, canRedeem: true, state: 'OFFER_PAUSED', discount: 20 });
    offer.publicationStatus = offerPublicationStatusEnum.PUBLISHED;
  });

  it('returns an already-redeemed result idempotently instead of creating another row', async () => {
    const existing = { redemptionId: 'redemption-1', baseOrderValue: 100, discount: 20, redeemedAt: new Date(), createdAt: new Date() } as any;
    claim.status = offerClaimStatusEnum.REDEEMED;
    claim.redemption = existing;
    const datasource = { transaction: jest.fn((callback) => callback(manager)) } as any;
    service = new OfferClaimRedemptionService(claimRepository, datasource, { calculateDiscount: jest.fn() } as any);

    const result = await service.redeem('org-1', { claimCode: 'QP-ABC', baseOrderValue: 100 } as any, 'staff-1');

    expect(result).toMatchObject({ success: true, state: 'REDEEMED' });
    expect(datasource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.getRepository).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'Redemption' }));
  });
});
