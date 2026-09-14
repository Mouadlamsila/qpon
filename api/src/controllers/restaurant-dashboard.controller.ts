import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '../decorators/permission.decorator';
import { RestaurantOffer } from '../entities/restaurant-offer.entity';
import { RestaurantDashboardService } from '../services/restaurant-dashboard.service';
import { RestaurantOfferService } from '../services/restaurant-offer.service';

@ApiTags('Restaurant Dashboard')
@Controller('organizations/:organization_id')
export class RestaurantDashboardController {
  constructor(
    private readonly dashboardService: RestaurantDashboardService,
    private readonly offerService: RestaurantOfferService,
  ) {}

  @Permissions('read', RestaurantOffer)
  @Get('restaurant-dashboard')
  async getDashboard(@Param('organization_id') organizationId: string) {
    const [dashboard, offers] = await Promise.all([
      this.dashboardService.getDashboard(organizationId),
      this.offerService.list(organizationId),
    ]);

    return {
      message: 'Successfully fetched restaurant dashboard',
      result: { ...dashboard, offers },
    };
  }

  @Permissions('read', RestaurantOffer)
  @Get('offers/:offer_id/activity')
  async getOfferActivity(
    @Param('organization_id') organizationId: string,
    @Param('offer_id') offerId: string,
  ) {
    const result = await this.dashboardService.getOfferActivity(organizationId, offerId);
    return { message: 'Successfully fetched offer activity', result };
  }
}
