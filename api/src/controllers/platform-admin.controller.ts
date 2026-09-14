import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '../decorators/permission.decorator';
import { Organization } from '../entities/organization.entity';
import { organizationStatusEnum } from '../enums';
import { PlatformAdminService } from '../services/platform-admin.service';

class UpdateRestaurantStatusDto {
  @IsEnum(organizationStatusEnum)
  status: organizationStatusEnum;
}

@ApiTags('Platform Admin')
@Controller('admin')
export class PlatformAdminController {
  constructor(private readonly adminService: PlatformAdminService) {}

  @Permissions('read_all', Organization)
  @Get('restaurants')
  async list(@Query('search') search?: string) {
    return { message: 'Successfully fetched restaurants', result: await this.adminService.listRestaurants(search) };
  }

  @Permissions('manage', Organization)
  @Get('restaurants/:organization_id')
  async get(@Param('organization_id') organizationId: string) {
    return { message: 'Successfully fetched restaurant', result: await this.adminService.getRestaurant(organizationId) };
  }

  @Permissions('manage', Organization)
  @Patch('restaurants/:organization_id/status')
  async updateStatus(@Param('organization_id') organizationId: string, @Body() body: UpdateRestaurantStatusDto) {
    return { message: 'Successfully updated restaurant status', result: await this.adminService.setRestaurantStatus(organizationId, body.status) };
  }

  @Permissions('manage', Organization)
  @Get('restaurants/:organization_id/offers')
  async offers(@Param('organization_id') organizationId: string) {
    return { message: 'Successfully fetched restaurant offers', result: await this.adminService.listOffers(organizationId) };
  }

  @Permissions('manage', Organization)
  @Get('restaurants/:organization_id/redemptions')
  async redemptions(@Param('organization_id') organizationId: string) {
    return { message: 'Successfully fetched restaurant redemptions', result: await this.adminService.listRedemptions(organizationId) };
  }
}
