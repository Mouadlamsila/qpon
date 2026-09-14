import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedemptionsService } from '../services/redemption.service';
import { RedemptionsController } from '../controllers/redemption.controller';
import { Redemption } from '../entities/redemption.entity';
import { RedemptionWorkbookConverter } from '../converters/redemption';
import { RedemptionReportWorkbookConverter } from '../converters/redemption-report';
import { CouponCode } from '../entities/coupon-code.entity';
import { CampaignSummaryMv } from '../entities/campaign-summary.view';
import { Campaign } from '../entities/campaign.entity';
import { OfferClaim } from '../entities/offer-claim.entity';
import { OfferClaimRedemptionService } from '../services/offer-claim-redemption.service';
import { User } from '../entities/user.entity';
import { RestaurantOffer } from '../entities/restaurant-offer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Redemption,
      CouponCode,
      CampaignSummaryMv,
      Campaign,
      OfferClaim,
      User,
      RestaurantOffer,
    ]),
  ],
  controllers: [RedemptionsController],
  providers: [
    RedemptionsService,
    RedemptionWorkbookConverter,
    RedemptionReportWorkbookConverter,
    OfferClaimRedemptionService,
  ],
})
export class RedemptionsModule {}
