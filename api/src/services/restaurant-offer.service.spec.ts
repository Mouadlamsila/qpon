import { NotFoundException } from '@nestjs/common';
import { RestaurantOfferService } from './restaurant-offer.service';
import {
  discountTypeEnum,
  durationTypeEnum,
  offerPublicationStatusEnum,
  statusEnum,
} from '../enums';

describe('RestaurantOfferService', () => {
  const repository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const datasource = {};
  const logger = { warn: jest.fn(), error: jest.fn() };
  const service = new RestaurantOfferService(repository as any, datasource as any, logger as any);

  beforeEach(() => jest.clearAllMocks());

  it('returns only the safe public offer projection for a published offer', async () => {
    repository.findOne.mockResolvedValue({
      offerId: 'internal-offer-id',
      title: 'Lunch deal',
      description: 'A fixed lunch discount',
      imageUrl: '/uploads/offers/lunch.webp',
      publicSlug: 'lunch-deal-a1b2c3d4',
      publicationStatus: offerPublicationStatusEnum.PUBLISHED,
      organization: { name: 'Restaurant One', logoUrl: null, status: 'active' },
      coupon: {
        couponId: 'internal-coupon-id',
        name: 'Lunch deal',
        status: statusEnum.ACTIVE,
        discountType: discountTypeEnum.FIXED,
        discountValue: 20,
        discountUpto: null,
        couponCodes: [{
          code: 'INTERNAL-CODE',
          durationType: durationTypeEnum.LIMITED,
          expiresAt: new Date(Date.now() + 86_400_000),
          minimumAmount: 100,
        }],
      },
    });

    const result = await service.getPublic('lunch-deal-a1b2c3d4');

    expect(result).toEqual(expect.objectContaining({
      title: 'Lunch deal',
      discountType: discountTypeEnum.FIXED,
      discountValue: 20,
      minimumAmount: 100,
      status: offerPublicationStatusEnum.PUBLISHED,
    }));
    expect(result).not.toHaveProperty('offerId');
    expect(result).not.toHaveProperty('couponId');
    expect(result).not.toHaveProperty('code');
    expect(result).not.toHaveProperty('coupon');
  });

  it('does not expose paused offers through the public lookup', async () => {
    repository.findOne.mockResolvedValue({
      publicationStatus: offerPublicationStatusEnum.PAUSED,
      organization: { name: 'Restaurant One', logoUrl: null, status: 'active' },
      coupon: { couponCodes: [{ expiresAt: new Date(Date.now() + 86_400_000) }] },
    });

    await expect(service.getPublic('paused-offer')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists offers under the requested organization scope', async () => {
    repository.find.mockResolvedValue([]);

    await service.list('organization-a');

    expect(repository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { organization: { organizationId: 'organization-a' } },
    }));
  });
});
