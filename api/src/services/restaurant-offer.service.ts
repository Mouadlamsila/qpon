import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { DataSource, Not, Repository } from 'typeorm';
import {
  campaignStatusEnum,
  couponCodeStatusEnum,
  customerConstraintEnum,
  discountTypeEnum,
  durationTypeEnum,
  itemConstraintEnum,
  offerPublicationStatusEnum,
  statusEnum,
  visibilityEnum,
} from '../enums';
import { Campaign } from '../entities/campaign.entity';
import { CouponCode } from '../entities/coupon-code.entity';
import { Coupon } from '../entities/coupon.entity';
import { RestaurantOffer } from '../entities/restaurant-offer.entity';
import {
  CreateRestaurantOfferDto,
  PublicRestaurantOfferDto,
  RestaurantOfferDto,
  UpdateRestaurantOfferDto,
} from '../dtos';
import { LoggerService } from './logger.service';
import { RestaurantDashboardService } from './restaurant-dashboard.service';

type UploadedImage = {
  buffer?: Buffer;
  mimetype?: string;
  size?: number;
};

const imageMimeTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class RestaurantOfferService {
  private readonly imageDirectory = join(__dirname, '..', '..', 'public', 'uploads', 'offers');

  constructor(
    @InjectRepository(RestaurantOffer)
    private readonly offerRepository: Repository<RestaurantOffer>,
    private readonly datasource: DataSource,
    private readonly logger: LoggerService,
    @Optional() private readonly dashboardService?: RestaurantDashboardService,
  ) {}

  async create(organizationId: string, body: CreateRestaurantOfferDto) {
    this.validateDiscount(body.discountType, body.discountValue, body.discountUpto);
    const validUntil = this.parseFutureDate(body.validUntil);

    return this.datasource.transaction(async (manager) => {
      try {
        const coupon = manager.create(Coupon, {
          name: body.title,
          itemConstraint: itemConstraintEnum.ALL,
          discountType: body.discountType,
          discountValue: body.discountValue,
          discountUpto: body.discountUpto,
          status: statusEnum.ACTIVE,
          organization: { organizationId },
        });
        const savedCoupon = await manager.save(Coupon, coupon);

        const campaign = manager.create(Campaign, {
          name: body.title,
          status: campaignStatusEnum.ACTIVE,
          coupon: { couponId: savedCoupon.couponId },
          organization: { organizationId },
        });
        const savedCampaign = await manager.save(Campaign, campaign);

        const couponCode = manager.create(CouponCode, {
          code: this.generateInternalCode(),
          customerConstraint: customerConstraintEnum.ALL,
          maxRedemptions: body.maxRedemptions,
          minimumAmount: body.minimumAmount,
          maxRedemptionPerCustomer: body.maxRedemptionPerCustomer,
          visibility: visibilityEnum.PUBLIC,
          durationType: durationTypeEnum.LIMITED,
          expiresAt: validUntil,
          status: couponCodeStatusEnum.ACTIVE,
          campaign: { campaignId: savedCampaign.campaignId },
          coupon: { couponId: savedCoupon.couponId },
          organization: { organizationId },
        });
        await manager.save(CouponCode, couponCode);

        const offer = manager.create(RestaurantOffer, {
          title: body.title,
          description: body.description ?? null,
          imageUrl: null,
          publicSlug: this.generatePublicSlug(body.title),
          publicationStatus: offerPublicationStatusEnum.DRAFT,
          coupon: { couponId: savedCoupon.couponId },
          organization: { organizationId },
        });
        const savedOffer = await manager.save(RestaurantOffer, offer);
        return this.toDto(await this.loadOffer(organizationId, savedOffer.offerId, manager));
      } catch (error) {
        this.rethrowKnown(error, 'Failed to create offer');
      }
    });
  }

  async list(organizationId: string) {
    const offers = await this.offerRepository.find({
      where: { organization: { organizationId } },
      relations: { organization: true, coupon: { couponCodes: true } },
      order: { createdAt: 'DESC' },
    });
    return this.enrichOfferDtos(organizationId, offers.map((offer) => this.toDto(offer)));
  }

  async get(organizationId: string, offerId: string) {
    const dto = this.toDto(await this.loadOffer(organizationId, offerId));
    const enriched = await this.enrichOfferDtos(organizationId, [dto]);
    return enriched[0];
  }

  async update(organizationId: string, offerId: string, body: UpdateRestaurantOfferDto) {
    const offer = await this.loadOffer(organizationId, offerId);
    const couponCode = this.primaryCode(offer);
    const discountType = body.discountType ?? offer.coupon.discountType;
    const discountValue = body.discountValue ?? offer.coupon.discountValue;
    this.validateDiscount(discountType, discountValue, body.discountUpto ?? offer.coupon.discountUpto);

    if (body.validUntil !== undefined) {
      const validUntil = this.parseFutureDate(body.validUntil);
      couponCode.expiresAt = validUntil;
    }
    if (body.title !== undefined) {
      offer.title = body.title;
      offer.coupon.name = body.title;
    }
    if (body.description !== undefined) offer.description = body.description;
    if (body.discountType !== undefined) offer.coupon.discountType = body.discountType;
    if (body.discountValue !== undefined) offer.coupon.discountValue = body.discountValue;
    if (body.discountUpto !== undefined) offer.coupon.discountUpto = body.discountUpto;
    if (body.minimumAmount !== undefined) couponCode.minimumAmount = body.minimumAmount;
    if (body.maxRedemptions !== undefined) couponCode.maxRedemptions = body.maxRedemptions;
    if (body.maxRedemptionPerCustomer !== undefined) {
      couponCode.maxRedemptionPerCustomer = body.maxRedemptionPerCustomer;
    }

    await this.datasource.transaction(async (manager) => {
      await manager.save(Coupon, offer.coupon);
      await manager.save(CouponCode, couponCode);
      await manager.save(RestaurantOffer, offer);
    });

    return this.toDto(await this.loadOffer(organizationId, offerId));
  }

  async publish(organizationId: string, offerId: string) {
    const offer = await this.loadOffer(organizationId, offerId);
    const current = this.effectiveStatus(offer);
    if (current === offerPublicationStatusEnum.ARCHIVED) {
      throw new BadRequestException('Archived offers cannot be published');
    }
    if (current === offerPublicationStatusEnum.EXPIRED) {
      throw new BadRequestException('Expired offers cannot be published');
    }
    offer.publicationStatus = offerPublicationStatusEnum.PUBLISHED;
    await this.offerRepository.save(offer);
    return this.toDto(await this.loadOffer(organizationId, offerId));
  }

  async pause(organizationId: string, offerId: string) {
    const offer = await this.loadOffer(organizationId, offerId);
    if (this.effectiveStatus(offer) === offerPublicationStatusEnum.ARCHIVED) {
      throw new BadRequestException('Archived offers cannot be paused');
    }
    offer.publicationStatus = offerPublicationStatusEnum.PAUSED;
    await this.offerRepository.save(offer);
    return this.toDto(await this.loadOffer(organizationId, offerId));
  }

  async archive(organizationId: string, offerId: string) {
    const offer = await this.loadOffer(organizationId, offerId);
    offer.publicationStatus = offerPublicationStatusEnum.ARCHIVED;
    await this.offerRepository.save(offer);
    return this.toDto(await this.loadOffer(organizationId, offerId));
  }

  async uploadImage(organizationId: string, offerId: string, file: UploadedImage) {
    const offer = await this.loadOffer(organizationId, offerId);
    if (!file?.buffer || !file.mimetype || !imageMimeTypes[file.mimetype]) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are supported');
    }
    if ((file.size ?? file.buffer.length) > 5 * 1024 * 1024) {
      throw new BadRequestException('Image must be 5 MB or smaller');
    }

    await fs.mkdir(this.imageDirectory, { recursive: true });
    const fileName = `${randomBytes(16).toString('hex')}.${imageMimeTypes[file.mimetype]}`;
    await fs.writeFile(join(this.imageDirectory, fileName), file.buffer);
    const oldImage = offer.imageUrl;
    offer.imageUrl = `/uploads/offers/${fileName}`;
    await this.offerRepository.save(offer);
    await this.removeStoredImage(oldImage);
    return this.toDto(await this.loadOffer(organizationId, offerId));
  }

  async getPublic(publicSlug: string): Promise<PublicRestaurantOfferDto> {
    const offer = await this.offerRepository.findOne({
      where: { publicSlug },
      relations: { organization: true, coupon: { couponCodes: true } },
    });
    if (!offer || this.effectiveStatus(offer) !== offerPublicationStatusEnum.PUBLISHED) {
      throw new NotFoundException('Offer not found');
    }
    const code = this.primaryCode(offer);
    return {
      title: offer.title,
      description: offer.description,
      imageUrl: offer.imageUrl,
      restaurant: {
        name: offer.organization.name,
        logoUrl: offer.organization.logoUrl,
      },
      discountType: offer.coupon.discountType,
      discountValue: Number(offer.coupon.discountValue),
      discountUpto: offer.coupon.discountUpto == null ? null : Number(offer.coupon.discountUpto),
      minimumAmount: code.minimumAmount == null ? null : Number(code.minimumAmount),
      validUntil: code.expiresAt,
      status: offerPublicationStatusEnum.PUBLISHED,
      terms: ['Offer is subject to restaurant availability.', 'Show this offer to the restaurant before ordering.'],
    };
  }

  private async loadOffer(organizationId: string, offerId: string, manager?: any) {
    const repository = manager?.getRepository(RestaurantOffer) ?? this.offerRepository;
    const offer = await repository.findOne({
      where: { offerId, organization: { organizationId } },
      relations: { organization: true, coupon: { couponCodes: true } },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  private primaryCode(offer: RestaurantOffer) {
    const code = offer.coupon?.couponCodes?.[0];
    if (!code) throw new ConflictException('Offer internal coupon code is missing');
    return code;
  }

  private toDto(offer: RestaurantOffer): RestaurantOfferDto {
    const code = this.primaryCode(offer);
    return {
      entity: 'org.quicko.qpon.restaurant_offer',
      offerId: offer.offerId,
      title: offer.title,
      description: offer.description,
      imageUrl: offer.imageUrl,
      publicSlug: offer.publicSlug,
      publicationStatus: this.effectiveStatus(offer),
      discountType: offer.coupon.discountType,
      discountValue: Number(offer.coupon.discountValue),
      discountUpto: offer.coupon.discountUpto == null ? null : Number(offer.coupon.discountUpto),
      minimumAmount: code.minimumAmount == null ? null : Number(code.minimumAmount),
      validUntil: code.expiresAt,
      maxRedemptions: code.maxRedemptions,
      maxRedemptionPerCustomer: code.maxRedemptionPerCustomer,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    };
  }

  private async enrichOfferDtos(organizationId: string, offers: RestaurantOfferDto[]) {
    if (!this.dashboardService || offers.length === 0) return offers;
    const metrics = await this.dashboardService.getOfferMetrics(
      organizationId,
      offers.map((offer) => offer.offerId),
    );
    return offers.map((offer) => ({
      ...offer,
      ...(metrics.get(offer.offerId) ?? { claimCount: 0, redemptionCount: 0, redemptionRate: 0 }),
    }));
  }

  private effectiveStatus(offer: RestaurantOffer) {
    const expiresAt = offer.coupon?.couponCodes?.[0]?.expiresAt;
    if (
      offer.publicationStatus === offerPublicationStatusEnum.PUBLISHED &&
      expiresAt &&
      new Date(expiresAt).getTime() <= Date.now()
    ) {
      return offerPublicationStatusEnum.EXPIRED;
    }
    return offer.publicationStatus;
  }

  private validateDiscount(type: discountTypeEnum, value: number, upto?: number | null) {
    if (!Number.isFinite(value) || value <= 0) throw new BadRequestException('Discount value must be greater than 0');
    if (type === discountTypeEnum.PERCENTAGE && value > 100) throw new BadRequestException('Percentage discount cannot exceed 100');
    if (upto != null && (!Number.isFinite(upto) || upto < 0)) throw new BadRequestException('Discount cap must be zero or greater');
  }

  private parseFutureDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      throw new BadRequestException('valid_until must be a future date');
    }
    return date;
  }

  private generateInternalCode() {
    return `OFFER-${randomBytes(8).toString('hex').toUpperCase()}`;
  }

  private generatePublicSlug(title: string) {
    const base = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'offer';
    return `${base}-${randomBytes(5).toString('hex')}`;
  }

  private async removeStoredImage(imageUrl: string | null) {
    if (!imageUrl || !imageUrl.startsWith('/uploads/offers/')) return;
    const fileName = basename(imageUrl);
    if (fileName !== imageUrl.slice('/uploads/offers/'.length)) return;
    try {
      await fs.unlink(join(this.imageDirectory, fileName));
    } catch (error: any) {
      if (error?.code !== 'ENOENT') this.logger.warn('Failed to remove replaced offer image');
    }
  }

  private rethrowKnown(error: any, message: string): never {
    if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof NotFoundException) throw error;
    this.logger.error(message, error);
    throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
