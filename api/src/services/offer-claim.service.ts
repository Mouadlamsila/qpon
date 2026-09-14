import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { CreateOfferClaimDto, PublicOfferClaimDto } from '../dtos';
import { Customer } from '../entities/customer.entity';
import { OfferClaim } from '../entities/offer-claim.entity';
import { RestaurantOffer } from '../entities/restaurant-offer.entity';
import { RateLimitService } from './rate-limit.service';
import {
  campaignStatusEnum,
  couponCodeStatusEnum,
  offerClaimStatusEnum,
  offerPublicationStatusEnum,
  statusEnum,
} from '../enums';

@Injectable()
export class OfferClaimService {
  private readonly rateLimitWindowMs = Number(process.env.PUBLIC_CLAIM_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000);
  private readonly rateLimitMaxAttempts = Number(process.env.PUBLIC_CLAIM_RATE_LIMIT_MAX ?? 10);

  constructor(
    @InjectRepository(OfferClaim)
    private readonly claimRepository: Repository<OfferClaim>,
    private readonly datasource: DataSource,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async create(publicSlug: string, body: CreateOfferClaimDto, clientIp?: string) {
    this.checkRateLimit(publicSlug, clientIp);
    const email = body.email.trim().toLowerCase();

    return this.datasource.transaction(async (manager) => {
      const offer = await manager
        .getRepository(RestaurantOffer)
        .createQueryBuilder('offer')
        .leftJoinAndSelect('offer.organization', 'organization')
        .leftJoinAndSelect('offer.coupon', 'coupon')
        .leftJoinAndSelect('coupon.couponCodes', 'couponCode')
        .leftJoinAndSelect('couponCode.campaign', 'campaign')
        .where('offer.public_slug = :publicSlug', { publicSlug })
        .setLock('pessimistic_write', undefined, ['offer'])
        .getOne();

      if (!offer) throw new NotFoundException('Offer not found');
      const code = this.validateOfferAvailability(offer);
      const customer = await this.findOrCreateCustomer(manager, offer.organization.organizationId, email);

      const existingClaim = await manager.getRepository(OfferClaim).findOne({
        where: {
          restaurantOffer: { offerId: offer.offerId },
          customer: { customerId: customer.customerId },
          status: offerClaimStatusEnum.CLAIMED,
        },
        relations: {
          organization: true,
          restaurantOffer: { organization: true, coupon: { couponCodes: true } },
          customer: true,
        },
      });

      if (existingClaim) {
        if (existingClaim.expiresAt.getTime() <= Date.now()) {
          existingClaim.status = offerClaimStatusEnum.EXPIRED;
          await manager.getRepository(OfferClaim).save(existingClaim);
        } else {
          return this.toPublicDto(existingClaim, this.decryptToken(existingClaim.retrievalTokenEncrypted));
        }
      }

      const retrievalToken = randomBytes(32).toString('base64url');
      const claim = manager.getRepository(OfferClaim).create({
        displayCode: await this.generateUniqueDisplayCode(manager.getRepository(OfferClaim)),
        codeLookupValue: '',
        retrievalTokenHash: this.hashToken(retrievalToken),
        retrievalTokenEncrypted: this.encryptToken(retrievalToken),
        status: offerClaimStatusEnum.CLAIMED,
        claimedAt: new Date(),
        expiresAt: code.expiresAt,
        redeemedAt: null,
        organization: { organizationId: offer.organization.organizationId },
        restaurantOffer: { offerId: offer.offerId },
        customer: { customerId: customer.customerId },
      });
      claim.codeLookupValue = claim.displayCode.toUpperCase();

      const savedClaim = await manager.getRepository(OfferClaim).save(claim);
      savedClaim.organization = offer.organization;
      savedClaim.restaurantOffer = offer;
      savedClaim.customer = customer;
      return this.toPublicDto(savedClaim, retrievalToken);
    });
  }

  async getByRetrievalToken(retrievalToken: string): Promise<PublicOfferClaimDto> {
    if (!/^[A-Za-z0-9_-]{32,}$/.test(retrievalToken)) {
      throw new NotFoundException('Claim not found');
    }

    const claim = await this.claimRepository.findOne({
      where: { retrievalTokenHash: this.hashToken(retrievalToken) },
      relations: {
        organization: true,
        restaurantOffer: { organization: true, coupon: { couponCodes: true } },
        customer: true,
      },
    });

    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.organization?.status !== 'active') throw new NotFoundException('Claim not found');
    if (claim.status === offerClaimStatusEnum.CLAIMED && claim.expiresAt.getTime() <= Date.now()) {
      claim.status = offerClaimStatusEnum.EXPIRED;
      await this.claimRepository.save(claim);
    }

    return this.toPublicDto(claim, retrievalToken);
  }

  private validateOfferAvailability(offer: RestaurantOffer) {
    const code = offer.coupon?.couponCodes?.[0];
    if (
      offer.organization?.status !== 'active' ||
      offer.publicationStatus !== offerPublicationStatusEnum.PUBLISHED ||
      offer.coupon?.status !== statusEnum.ACTIVE ||
      !code ||
      code.status !== couponCodeStatusEnum.ACTIVE ||
      code.campaign?.status !== campaignStatusEnum.ACTIVE
    ) {
      throw new NotFoundException('Offer not available');
    }

    if (new Date(code.expiresAt).getTime() <= Date.now()) {
      throw new NotFoundException('Offer not available');
    }

    if (code.maxRedemptions != null && code.redemptionCount >= code.maxRedemptions) {
      throw new ConflictException('Offer claim limit has been reached');
    }

    return code;
  }

  private async findOrCreateCustomer(manager: any, organizationId: string, email: string) {
    const repository = manager.getRepository(Customer) as Repository<Customer>;
    let customer = await repository
      .createQueryBuilder('customer')
      .where('customer.organization_id = :organizationId', { organizationId })
      .andWhere('LOWER(BTRIM(customer.email)) = :email', { email })
      .andWhere('customer.status = :status', { status: statusEnum.ACTIVE })
      .getOne();

    if (!customer) {
      customer = repository.create({
        name: undefined,
        email,
        externalId: undefined,
        organization: { organizationId },
        status: statusEnum.ACTIVE,
      });
      customer = await repository.save(customer);
    }

    return customer;
  }

  private async generateUniqueDisplayCode(repository: Repository<OfferClaim>) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `QP-${randomBytes(8).toString('hex').toUpperCase()}`;
      const exists = await repository.exists({ where: { codeLookupValue: code } });
      if (!exists) return code;
    }
    throw new InternalServerErrorException('Unable to generate a unique claim code');
  }

  private toPublicDto(claim: OfferClaim, retrievalToken: string): PublicOfferClaimDto {
    const offer = claim.restaurantOffer;
    const code = offer.coupon?.couponCodes?.[0];
    if (!offer.organization || !offer.coupon || !code) {
      throw new InternalServerErrorException('Claim offer data is incomplete');
    }

    return {
      offer: {
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
        status: offer.publicationStatus,
        terms: [
          'Show this claim to the restaurant before ordering.',
          'This claim is for one customer and cannot be transferred.',
        ],
      },
      displayCode: claim.displayCode,
      status: claim.status,
      claimedAt: claim.claimedAt,
      expiresAt: claim.expiresAt,
      claimUrl: `/claim/${retrievalToken}`,
    };
  }

  private checkRateLimit(publicSlug: string, clientIp?: string) {
    const key = `${clientIp || 'unknown'}:${publicSlug}`;
    if (!this.rateLimitService.consume(key, this.rateLimitMaxAttempts, this.rateLimitWindowMs)) {
      throw new HttpException(
        'Too many claim attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private encryptionKey() {
    const secret = process.env.CLAIM_TOKEN_SECRET || (process.env.NODE_ENV !== 'production' ? process.env.JWT_SECRET : undefined);
    if (!secret) throw new InternalServerErrorException('Claim token encryption is not configured');
    return createHash('sha256').update(secret).digest();
  }

  private encryptToken(token: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
  }

  private decryptToken(value: string) {
    try {
      const [ivValue, tagValue, encryptedValue] = value.split('.');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey(),
        Buffer.from(ivValue, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException('Claim token is unavailable');
    }
  }
}
