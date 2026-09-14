import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfferClaim } from '../entities/offer-claim.entity';
import { RestaurantOffer } from '../entities/restaurant-offer.entity';
import { OfferClaimController } from '../controllers/offer-claim.controller';
import { OfferClaimService } from '../services/offer-claim.service';
import { RateLimitService } from '../services/rate-limit.service';

@Module({
  imports: [TypeOrmModule.forFeature([OfferClaim, RestaurantOffer])],
  controllers: [OfferClaimController],
  providers: [OfferClaimService, RateLimitService],
})
export class OfferClaimModule {}
