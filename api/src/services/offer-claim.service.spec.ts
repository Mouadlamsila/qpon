import { NotFoundException } from '@nestjs/common';
import { OfferClaimService } from './offer-claim.service';
import {
  campaignStatusEnum,
  couponCodeStatusEnum,
  discountTypeEnum,
  offerClaimStatusEnum,
  offerPublicationStatusEnum,
  statusEnum,
} from '../enums';

describe('OfferClaimService', () => {
  const organization = { organizationId: 'org-1', name: 'Test Restaurant', logoUrl: null } as any;
  const customer = { customerId: 'customer-1', email: 'customer@example.com', organization } as any;
  const code = {
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    status: couponCodeStatusEnum.ACTIVE,
    campaign: { status: campaignStatusEnum.ACTIVE },
    minimumAmount: 20,
    maxRedemptions: null,
    redemptionCount: 0,
  } as any;
  const offer = {
    offerId: 'offer-1',
    publicSlug: 'test-offer',
    title: 'Dinner deal',
    description: 'A test offer',
    imageUrl: null,
    publicationStatus: offerPublicationStatusEnum.PUBLISHED,
    organization,
    coupon: {
      status: statusEnum.ACTIVE,
      discountType: discountTypeEnum.PERCENTAGE,
      discountValue: 15,
      discountUpto: null,
      couponCodes: [code],
    },
  } as any;

  let claimRepository: any;
  let customerRepository: any;
  let manager: any;
  let service: OfferClaimService;

  beforeEach(() => {
    process.env.JWT_SECRET = 'offer-claim-test-secret';
    claimRepository = {
      exists: jest.fn().mockResolvedValue(false),
      findOne: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ claimId: 'claim-1', ...value })),
    };
    customerRepository = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(undefined),
      })),
      create: jest.fn((value) => ({ customerId: 'customer-1', ...value })),
      save: jest.fn(async (value) => value),
    };
    const offerQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(offer),
    };
    manager = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'RestaurantOffer') return { createQueryBuilder: jest.fn(() => offerQueryBuilder) };
        if (entity.name === 'Customer') return customerRepository;
        return claimRepository;
      }),
    };
    const datasource = { transaction: jest.fn((callback) => callback(manager)) } as any;
    service = new OfferClaimService(claimRepository, datasource);
  });

  it('creates a tenant-scoped customer and a private claim without exposing identity', async () => {
    const result = await service.create('test-offer', { email: '  Customer@Example.COM ' } as any, '127.0.0.1');

    expect(result.displayCode).toMatch(/^QP-[A-F0-9]{16}$/);
    expect(result.claimUrl).toMatch(/^\/claim\/[A-Za-z0-9_-]{43}$/);
    expect(result.offer.restaurant.name).toBe('Test Restaurant');
    expect(result).not.toHaveProperty('customer');
    expect(result).not.toHaveProperty('organizationId');
    expect(customerRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'customer@example.com',
      organization: { organizationId: 'org-1' },
    }));
    expect(claimRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      status: offerClaimStatusEnum.CLAIMED,
      organization: { organizationId: 'org-1' },
      restaurantOffer: { offerId: 'offer-1' },
      customer: { customerId: 'customer-1' },
    }));
  });

  it('returns the existing active claim for a repeated normalized email', async () => {
    const first = await service.create('test-offer', { email: 'customer@example.com' } as any, '127.0.0.2');
    const saved = claimRepository.save.mock.results[0].value;
    claimRepository.findOne.mockResolvedValue({
      claimId: 'claim-1',
      ...await saved,
      organization,
      restaurantOffer: offer,
      customer,
    });

    const second = await service.create('test-offer', { email: ' CUSTOMER@example.com ' } as any, '127.0.0.3');

    expect(second.displayCode).toBe(first.displayCode);
    expect(second.claimUrl).toBe(first.claimUrl);
    expect(claimRepository.save).toHaveBeenCalledTimes(1);
  });

  it.each([
    offerPublicationStatusEnum.DRAFT,
    offerPublicationStatusEnum.PAUSED,
    offerPublicationStatusEnum.ARCHIVED,
  ])('rejects a %s offer', async (publicationStatus) => {
    offer.publicationStatus = publicationStatus;
    await expect(service.create('test-offer', { email: 'customer@example.com' } as any)).rejects.toBeInstanceOf(NotFoundException);
    offer.publicationStatus = offerPublicationStatusEnum.PUBLISHED;
  });

  it('rejects an expired code and does not create a customer', async () => {
    code.expiresAt = new Date(Date.now() - 1000);
    await expect(service.create('test-offer', { email: 'customer@example.com' } as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(customerRepository.create).not.toHaveBeenCalled();
    code.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  });

  it('reopens a valid claim by hash lookup and marks expired claims on retrieval', async () => {
    const first = await service.create('test-offer', { email: 'customer@example.com' } as any, '127.0.0.4');
    const saved = await claimRepository.save.mock.results[0].value;
    const storedClaim = {
      ...saved,
      organization,
      restaurantOffer: offer,
      customer,
    };
    claimRepository.findOne.mockResolvedValue(storedClaim);

    const reopened = await service.getByRetrievalToken(first.claimUrl.split('/').pop()!);
    expect(reopened.displayCode).toBe(first.displayCode);
    expect(claimRepository.save).toHaveBeenCalledTimes(1);

    storedClaim.status = offerClaimStatusEnum.CLAIMED;
    storedClaim.expiresAt = new Date(Date.now() - 1000);
    await service.getByRetrievalToken(first.claimUrl.split('/').pop()!);
    expect(storedClaim.status).toBe(offerClaimStatusEnum.EXPIRED);
  });

  it('does not accept malformed retrieval tokens', async () => {
    await expect(service.getByRetrievalToken('short')).rejects.toBeInstanceOf(NotFoundException);
    expect(claimRepository.findOne).not.toHaveBeenCalled();
  });
});
