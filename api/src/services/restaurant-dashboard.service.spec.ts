import { RestaurantDashboardService } from './restaurant-dashboard.service';

const builder = (overrides: Record<string, any> = {}) => {
  const query: any = {
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getRawOne: jest.fn().mockResolvedValue(undefined),
    getRawMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  return query;
};

describe('RestaurantDashboardService', () => {
  it('returns organization-scoped restaurant metrics and a safe recent activity projection', async () => {
    const activeOffersQuery = builder({ getRawOne: jest.fn().mockResolvedValue({ count: '2' }) });
    const bestQuery = builder({ getRawOne: jest.fn().mockResolvedValue({ offerId: 'offer-a', title: 'Dinner', redemptions: '3' }) });
    const recentQuery = builder({
      getRawMany: jest.fn().mockResolvedValue([{
        redemptionId: 'redemption-a',
        offerTitle: 'Dinner',
        claimCode: 'QP-ABC',
        customerEmail: 'customer@example.com',
        baseOrderValue: '100',
        discount: '20',
        redeemedAt: '2026-09-14T12:00:00.000Z',
        redeemedBy: 'Staff',
      }]),
    });
    const redemptionCountQuery = builder({ getCount: jest.fn().mockResolvedValue(3) });
    const todayCountQuery = builder({ getCount: jest.fn().mockResolvedValue(1) });
    const offerRepository = { createQueryBuilder: jest.fn().mockReturnValue(activeOffersQuery) };
    const claimRepository = { count: jest.fn().mockResolvedValue(10), createQueryBuilder: jest.fn() };
    const redemptionRepository = {
      createQueryBuilder: jest.fn()
        .mockReturnValueOnce(redemptionCountQuery)
        .mockReturnValueOnce(todayCountQuery)
        .mockReturnValueOnce(recentQuery)
        .mockReturnValueOnce(bestQuery),
    };
    const service = new RestaurantDashboardService(offerRepository as any, claimRepository as any, redemptionRepository as any);

    const result = await service.getDashboard('organization-a');

    expect(result.stats).toEqual({ activeOffers: 2, totalClaims: 10, totalRedemptions: 3, todaysRedemptions: 1, redemptionRate: 30 });
    expect(result.bestPerformingOffer).toEqual({ offerId: 'offer-a', title: 'Dinner', redemptions: 3 });
    expect(result.recentRedemptions[0]).toMatchObject({ offerTitle: 'Dinner', claimCode: 'QP-ABC', discount: 20 });
    expect(activeOffersQuery.where).toHaveBeenCalledWith('offer.organization_id = :organizationId', { organizationId: 'organization-a' });
    expect(redemptionCountQuery.where).toHaveBeenCalledWith('redemption.organization_id = :organizationId', { organizationId: 'organization-a' });
  });

  it('calculates offer metrics from OfferClaim and claim-backed Redemption rows, including zero-claim offers', async () => {
    const claimsQuery = builder({ getRawMany: jest.fn().mockResolvedValue([{ offerId: 'offer-a', count: '4' }]) });
    const redemptionsQuery = builder({ getRawMany: jest.fn().mockResolvedValue([{ offerId: 'offer-a', count: '2' }]) });
    const claimRepository = { createQueryBuilder: jest.fn().mockReturnValue(claimsQuery) };
    const redemptionRepository = { createQueryBuilder: jest.fn().mockReturnValue(redemptionsQuery) };
    const service = new RestaurantDashboardService({} as any, claimRepository as any, redemptionRepository as any);

    const result = await service.getOfferMetrics('organization-a', ['offer-a', 'offer-b']);

    expect(result.get('offer-a')).toEqual({ claimCount: 4, redemptionCount: 2, redemptionRate: 50 });
    expect(result.get('offer-b')).toEqual({ claimCount: 0, redemptionCount: 0, redemptionRate: 0 });
    expect(claimsQuery.where).toHaveBeenCalledWith('claim.organization_id = :organizationId', { organizationId: 'organization-a' });
    expect(redemptionsQuery.where).toHaveBeenCalledWith('redemption.organization_id = :organizationId', { organizationId: 'organization-a' });
  });

  it('never produces NaN for a dashboard with no claims or redemptions', async () => {
    const activeOffersQuery = builder({ getRawOne: jest.fn().mockResolvedValue({ count: '0' }) });
    const claimRepository = { count: jest.fn().mockResolvedValue(0) };
    const redemptionRepository = {
      createQueryBuilder: jest.fn()
        .mockReturnValueOnce(builder({ getCount: jest.fn().mockResolvedValue(0) }))
        .mockReturnValueOnce(builder({ getCount: jest.fn().mockResolvedValue(0) }))
        .mockReturnValueOnce(builder())
        .mockReturnValueOnce(builder()),
    };
    const service = new RestaurantDashboardService({ createQueryBuilder: jest.fn().mockReturnValue(activeOffersQuery) } as any, claimRepository as any, redemptionRepository as any);

    const result = await service.getDashboard('organization-empty');

    expect(result.stats).toMatchObject({ activeOffers: 0, totalClaims: 0, totalRedemptions: 0, todaysRedemptions: 0, redemptionRate: 0 });
    expect(Number.isNaN(result.stats.redemptionRate)).toBe(false);
  });
});
