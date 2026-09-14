import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantOffer } from '../entities/restaurant-offer.entity';
import { RestaurantOfferController } from '../controllers/restaurant-offer.controller';
import { RestaurantOfferService } from '../services/restaurant-offer.service';

@Module({
  imports: [TypeOrmModule.forFeature([RestaurantOffer])],
  controllers: [RestaurantOfferController],
  providers: [RestaurantOfferService],
  exports: [RestaurantOfferService],
})
export class RestaurantOfferModule {}
