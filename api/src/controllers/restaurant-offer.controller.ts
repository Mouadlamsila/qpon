import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '../decorators/permission.decorator';
import { Public } from '../decorators/public.decorator';
import { RestaurantOffer } from '../entities/restaurant-offer.entity';
import {
  CreateRestaurantOfferDto,
  UpdateRestaurantOfferDto,
} from '../dtos';
import { Body } from '@nestjs/common';
import { RestaurantOfferService } from '../services/restaurant-offer.service';

@ApiTags('Restaurant Offers')
@Controller()
export class RestaurantOfferController {
  constructor(private readonly offerService: RestaurantOfferService) {}

  @Permissions('create', RestaurantOffer)
  @Post('organizations/:organization_id/offers')
  async create(@Param('organization_id') organizationId: string, @Body() body: CreateRestaurantOfferDto) {
    return { message: 'Successfully created offer', result: await this.offerService.create(organizationId, body) };
  }

  @Permissions('read_all', RestaurantOffer)
  @Get('organizations/:organization_id/offers')
  async list(@Param('organization_id') organizationId: string) {
    return { message: 'Successfully fetched offers', result: await this.offerService.list(organizationId) };
  }

  @Permissions('read', RestaurantOffer)
  @Get('organizations/:organization_id/offers/:offer_id')
  async get(@Param('organization_id') organizationId: string, @Param('offer_id') offerId: string) {
    return { message: 'Successfully fetched offer', result: await this.offerService.get(organizationId, offerId) };
  }

  @Permissions('update', RestaurantOffer)
  @Patch('organizations/:organization_id/offers/:offer_id')
  async update(@Param('organization_id') organizationId: string, @Param('offer_id') offerId: string, @Body() body: UpdateRestaurantOfferDto) {
    return { message: 'Successfully updated offer', result: await this.offerService.update(organizationId, offerId, body) };
  }

  @Permissions('update', RestaurantOffer)
  @Post('organizations/:organization_id/offers/:offer_id/publish')
  async publish(@Param('organization_id') organizationId: string, @Param('offer_id') offerId: string) {
    return { message: 'Successfully published offer', result: await this.offerService.publish(organizationId, offerId) };
  }

  @Permissions('update', RestaurantOffer)
  @Post('organizations/:organization_id/offers/:offer_id/pause')
  async pause(@Param('organization_id') organizationId: string, @Param('offer_id') offerId: string) {
    return { message: 'Successfully paused offer', result: await this.offerService.pause(organizationId, offerId) };
  }

  @Permissions('update', RestaurantOffer)
  @Post('organizations/:organization_id/offers/:offer_id/archive')
  async archive(@Param('organization_id') organizationId: string, @Param('offer_id') offerId: string) {
    return { message: 'Successfully archived offer', result: await this.offerService.archive(organizationId, offerId) };
  }

  @Permissions('update', RestaurantOffer)
  @Post('organizations/:organization_id/offers/:offer_id/image')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(@Param('organization_id') organizationId: string, @Param('offer_id') offerId: string, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('An image file is required');
    return { message: 'Successfully uploaded offer image', result: await this.offerService.uploadImage(organizationId, offerId, file) };
  }

  @Public()
  @Get('public/offers/:public_slug')
  async publicOffer(@Param('public_slug') publicSlug: string) {
    return { message: 'Successfully fetched public offer', result: await this.offerService.getPublic(publicSlug) };
  }
}
