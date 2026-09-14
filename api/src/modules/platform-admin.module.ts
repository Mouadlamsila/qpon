import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../entities/organization.entity';
import { RestaurantOffer } from '../entities/restaurant-offer.entity';
import { OfferClaim } from '../entities/offer-claim.entity';
import { Redemption } from '../entities/redemption.entity';
import { PlatformAdminController } from '../controllers/platform-admin.controller';
import { PlatformAdminService } from '../services/platform-admin.service';
import { RestaurantOfferModule } from './restaurant-offer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, RestaurantOffer, OfferClaim, Redemption]),
    RestaurantOfferModule,
  ],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService],
})
export class PlatformAdminModule {}
