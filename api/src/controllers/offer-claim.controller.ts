import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CreateOfferClaimDto } from '../dtos';
import { Public } from '../decorators/public.decorator';
import { OfferClaimService } from '../services/offer-claim.service';

@ApiTags('Offer Claims')
@Controller('public')
export class OfferClaimController {
  constructor(private readonly offerClaimService: OfferClaimService) {}

  @Public()
  @Post('offers/:public_slug/claims')
  async create(
    @Param('public_slug') publicSlug: string,
    @Body() body: CreateOfferClaimDto,
    @Req() request: Request,
  ) {
    return {
      message: 'Successfully claimed offer',
      result: await this.offerClaimService.create(publicSlug, body, request.ip),
    };
  }

  @Public()
  @Get('claims/:retrieval_token')
  async get(@Param('retrieval_token') retrievalToken: string) {
    return {
      message: 'Successfully fetched offer claim',
      result: await this.offerClaimService.getByRetrievalToken(retrievalToken),
    };
  }
}
