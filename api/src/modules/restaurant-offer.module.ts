import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantOffer } from '../entities/restaurant-offer.entity';
import { RestaurantOfferController } from '../controllers/restaurant-offer.controller';
import { RestaurantOfferService } from '../services/restaurant-offer.service';
import { RestaurantDashboardService } from '../services/restaurant-dashboard.service';
import { RestaurantDashboardController } from '../controllers/restaurant-dashboard.controller';
import { OfferClaim } from '../entities/offer-claim.entity';
import { Redemption } from '../entities/redemption.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RestaurantOffer, OfferClaim, Redemption])],
  controllers: [RestaurantOfferController, RestaurantDashboardController],
  providers: [RestaurantOfferService, RestaurantDashboardService],
  exports: [RestaurantOfferService, RestaurantDashboardService],
})
export class RestaurantOfferModule {}
