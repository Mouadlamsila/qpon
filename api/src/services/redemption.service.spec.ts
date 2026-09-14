import { ConflictException, GoneException } from '@nestjs/common';
import { RedemptionsService } from './redemption.service';
import { discountTypeEnum, durationTypeEnum } from '../enums';
import { Coupon } from '../entities/coupon.entity';

describe('RedemptionsService Phase 1 safeguards', () => {
  const service = new RedemptionsService(
    {} as any,
    {} as any,
    { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
    {} as any,
  );

  const coupon = (overrides: Partial<Coupon> = {}) => ({
    discountType: discountTypeEnum.PERCENTAGE,
    discountValue: 20,
    discountUpto: null,
    ...overrides,
  } as Coupon);

  it('calculates a percentage discount from the server-side coupon definition and applies the cap', () => {
    expect((service as any).calculateDiscount(coupon({ discountUpto: 15 }), 100)).toBe(15);
  });

  it('caps a fixed discount at the order value', () => {
    expect((service as any).calculateDiscount(coupon({
      discountType: discountTypeEnum.FIXED,
      discountValue: 150,
    }), 100)).toBe(100);
  });

  it('rejects an invalid percentage definition', () => {
    expect(() => (service as any).calculateDiscount(coupon({ discountValue: 101 }), 100))
      .toThrow(ConflictException);
  });

  it('rejects expired limited coupon codes', () => {
    expect(() => (service as any).validateCouponCode({
      code: 'EXPIRED',
      durationType: durationTypeEnum.LIMITED,
      expiresAt: new Date(Date.now() - 1000),
    })).toThrow(GoneException);
  });
});
