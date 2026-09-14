import {
  BadRequestException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  EntityManager,
  FindOptionsWhere,
  ILike,
  Repository,
} from 'typeorm';
import { stringify } from 'csv-stringify';
import { Redemption } from '../entities/redemption.entity';
import { LoggerService } from './logger.service';
import { CreateRedemptionDto } from '../dtos/redemption.dto';
import { CouponCode } from '../entities/coupon-code.entity';
import {
  campaignStatusEnum,
  couponCodeStatusEnum,
  customerConstraintEnum,
  durationTypeEnum,
  itemConstraintEnum,
  sortOrderEnum,
  discountTypeEnum,
  statusEnum,
} from '../enums';
import { Customer } from '../entities/customer.entity';
import { CustomerCouponCode } from '../entities/customer-coupon-code.entity';
import { Coupon } from '../entities/coupon.entity';
import { Item } from '../entities/item.entity';
import { CouponItem } from '../entities/coupon-item.entity';
import { Campaign } from '../entities/campaign.entity';
import { RedemptionWorkbookConverter } from '../converters/redemption';
import { PassThrough } from 'stream';
import { formatDateReport } from 'src/utils/date.utils';

@Injectable()
export class RedemptionsService {
  constructor(
    @InjectRepository(Redemption)
    private readonly redemptionsRepository: Repository<Redemption>,
    private redemptionWorkbookConverter: RedemptionWorkbookConverter,
    private logger: LoggerService,
    private datasource: DataSource,
  ) { }

  /**
   * Redeem coupon code
   */
  async redeemCouponCode(organizationId: string, body: CreateRedemptionDto) {
    this.logger.info('START: redeemCouponCode service');
    try {
      const result = await this.datasource.transaction(async (manager) => {
        if (body.externalId) {
          const existingRedemption = await manager.findOne(Redemption, {
            where: {
              externalId: body.externalId,
              organization: { organizationId },
            },
          });

          if (existingRedemption) {
            return existingRedemption;
          }
        }

        const lockedCouponCode = await manager.findOne(CouponCode, {
          where: {
            code: body.code,
            status: couponCodeStatusEnum.ACTIVE,
            organization: {
              organizationId,
            },
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (!lockedCouponCode) {
          this.logger.warn('Coupon code not found', { code: body.code });
          throw new NotFoundException('Coupon code not found');
        }

        const couponCode = await manager.findOne(CouponCode, {
          relations: {
            coupon: true,
            campaign: true,
            organization: true,
          },
          where: { couponCodeId: lockedCouponCode.couponCodeId },
        });

        if (!couponCode) {
          throw new NotFoundException('Coupon code not found');
        }

        this.validateCouponCode(couponCode);

        if (!couponCode.coupon || couponCode.coupon.status !== statusEnum.ACTIVE) {
          throw new ConflictException('Coupon is inactive');
        }

        if (!couponCode.campaign || couponCode.campaign.status !== campaignStatusEnum.ACTIVE) {
          throw new ConflictException('Campaign is inactive');
        }

        const customerId = await this.validateCustomer(
          manager,
          body.externalCustomerId,
          couponCode,
          organizationId,
        );

        const itemId = await this.validateItem(
          manager,
          body.externalItemId,
          couponCode.coupon,
          organizationId,
        );

        await this.checkCouponCodeRedemptions(
          manager,
          couponCode,
          customerId,
          body.baseOrderValue,
        );

        const discount = this.calculateDiscount(
          couponCode.coupon,
          body.baseOrderValue,
        );

        const campaign = await manager.findOne(Campaign, {
          where: {
            campaignId: couponCode.campaign.campaignId,
            organization: { organizationId },
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (!campaign || campaign.status !== campaignStatusEnum.ACTIVE) {
          throw new ConflictException('Campaign is inactive');
        }

        if (campaign.budget !== null && campaign.budget !== undefined) {
          const budgetResult = await manager
            .createQueryBuilder(Redemption, 'redemption')
            .select('COALESCE(SUM(redemption.discount), 0)', 'total')
            .where('redemption.campaign_id = :campaignId', {
              campaignId: campaign.campaignId,
            })
            .andWhere('redemption.organization_id = :organizationId', {
              organizationId,
            })
            .getRawOne<{ total: string }>();

          const totalRedemptionAmount = Number(budgetResult?.total ?? 0);
          if (!Number.isFinite(totalRedemptionAmount) ||
              totalRedemptionAmount + discount > Number(campaign.budget)) {
            throw new ConflictException('Campaign budget exceeded');
          }
        }

        await manager.increment(
          CouponCode,
          { couponCodeId: couponCode.couponCodeId },
          'redemptionCount',
          1,
        );
        couponCode.redemptionCount = Number(couponCode.redemptionCount || 0) + 1;

        const savedRedemption = await this.saveRedemption(
          manager,
          couponCode,
          organizationId,
          customerId,
          itemId,
          body.baseOrderValue,
          discount,
          body.externalId,
        );

        if (
          couponCode.maxRedemptions &&
          couponCode.redemptionCount >= couponCode.maxRedemptions
        ) {
          await manager.update(CouponCode, couponCode.couponCodeId, {
            status: couponCodeStatusEnum.REDEEMED,
          });
        }

        if (campaign.budget !== null && campaign.budget !== undefined) {
          const totalAfterRedemption = await manager
            .createQueryBuilder(Redemption, 'redemption')
            .select('COALESCE(SUM(redemption.discount), 0)', 'total')
            .where('redemption.campaign_id = :campaignId', {
              campaignId: campaign.campaignId,
            })
            .andWhere('redemption.organization_id = :organizationId', {
              organizationId,
            })
            .getRawOne<{ total: string }>();

          if (Number(totalAfterRedemption?.total ?? 0) >= Number(campaign.budget)) {
            await manager.update(Campaign, campaign.campaignId, {
              status: campaignStatusEnum.EXHAUSTED,
            });
            await manager
              .createQueryBuilder()
              .update(CouponCode)
              .set({ status: couponCodeStatusEnum.INACTIVE })
              .where('campaign_id = :campaignId', { campaignId: campaign.campaignId })
              .andWhere('organization_id = :organizationId', { organizationId })
              .andWhere('status = :status', { status: couponCodeStatusEnum.ACTIVE })
              .execute();
          }
        }

        return savedRedemption;
      });
      this.logger.info('END: redeemCouponCode service');
      return result;
    } catch (error) {
      this.logger.error(`Error in redeemCouponCode:`, error);

      // The unique redemption external-ID index is the final arbiter when
      // two identical retries arrive concurrently. Return the committed row
      // from outside the failed transaction instead of surfacing a 500.
      if ((error as any)?.code === '23505' && body.externalId) {
        const existingRedemption = await this.redemptionsRepository.findOne({
          where: {
            externalId: body.externalId,
            organization: { organizationId },
          },
        });
        if (existingRedemption) {
          return existingRedemption;
        }
      }

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof GoneException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      throw new HttpException(
        'Failed to redeem coupon code',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fetch redemptions
   */
  async fetchRedemptions(
    organizationId,
    whereOptions: FindOptionsWhere<Redemption> = {},
    skip: number = 0,
    take: number = 10,
    sortBy?: string,
    sortOrder?: sortOrderEnum,
    from?: string,
    to?: string,
  ) {
    this.logger.info('START: fetchRedemptions service');

    try {
      let emailFilter: string = '';

      /**
       * Customer email filter
       */
      if (whereOptions.customer) {
        emailFilter = whereOptions.customer?.valueOf()['email'] as string;
        delete whereOptions.customer;
      }

      /**
       * DATE RANGE FILTER
       */
      let dateFilter: any = undefined;

      if (from && to) {
        dateFilter = Between(new Date(from), new Date(to));
      }

      const [redemptions, count] =
        await this.redemptionsRepository.findAndCount({
          relations: {
            couponCode: true,
            customer: true,
            item: true,
          },
          where: {
            organization: {
              organizationId,
            },
            customer: {
              ...(emailFilter && { email: ILike(`%${emailFilter}%`) }),
            },
            ...(dateFilter && { redemptionDate: dateFilter }),
            ...whereOptions,
          },
          ...(sortBy && { order: { [sortBy]: sortOrder } }),
          select: {
            customer: {
              name: true,
              email: true,
            },
          },
          skip,
          take,
        });

      if (!redemptions || redemptions.length === 0) {
        this.logger.warn('Redemptions not found');
      }

      this.logger.info('END: fetchRedemptions service');

      return this.redemptionWorkbookConverter.convert(
        redemptions,
        organizationId,
        count,
        skip,
        take,
      );
    } catch (error) {
      this.logger.error(`Error in fetchRedemptions:`, error);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new HttpException(
        'Failed to fetch redemptions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  private validateCouponCode(couponCode: CouponCode) {
    if (
      couponCode.durationType == durationTypeEnum.LIMITED &&
      (!couponCode.expiresAt || couponCode.expiresAt < new Date())
    ) {
      this.logger.warn('Coupon code is expired', { code: couponCode.code });
      throw new GoneException('Coupon code is expired');
    }
  }

  private async validateCustomer(
    manager: EntityManager,
    externalCustomerId: string,
    couponCode: CouponCode,
    organizationId: string,
  ) {
    const customer = await manager.findOne(Customer, {
      where: {
        externalId: externalCustomerId,
        organization: { organizationId },
        status: statusEnum.ACTIVE,
      },
    });

    if (!customer) {
      this.logger.warn('Customer not found', { externalCustomerId });
      throw new NotFoundException('Customer not found');
    }

    if (couponCode.customerConstraint == customerConstraintEnum.SPECIFIC) {
      const customerCouponCode = await manager.findOne(CustomerCouponCode, {
        where: {
          customer: {
            customerId: customer.customerId,
          },
          couponCodeId: couponCode.couponCodeId,
        },
      });

      if (!customerCouponCode) {
        this.logger.warn('Customer is not eligible for this coupon');
        throw new ConflictException('Customer is ineligible');
      }
    }

    return customer.customerId;
  }

  private async validateItem(
    manager: EntityManager,
    externalItemId: string,
    coupon: Coupon,
    organizationId: string,
  ) {
    const item = await manager.findOne(Item, {
      where: {
        externalId: externalItemId,
        organization: { organizationId },
        status: statusEnum.ACTIVE,
      },
    });

    if (!item) {
      this.logger.warn('Item not found');
      throw new NotFoundException('Item not found');
    }

    if (coupon.itemConstraint === itemConstraintEnum.SPECIFIC) {
      const couponItem = await manager.findOne(CouponItem, {
        where: {
          coupon: {
            couponId: coupon.couponId,
          },
          item: {
            itemId: item.itemId,
          },
        },
      });

      if (!couponItem) {
        this.logger.warn('Item not eligible');
        throw new ConflictException('Item is ineligible');
      }
    }

    return item.itemId;
  }

  private async checkCouponCodeRedemptions(
    manager: EntityManager,
    couponCode: CouponCode,
    customerId: string,
    baseOrderValue: number,
  ) {
    if (
      couponCode.minimumAmount &&
      baseOrderValue < couponCode.minimumAmount
    ) {
      this.logger.warn(
        `Coupon code eligible for amount greater than ${couponCode.minimumAmount}`,
      );
      throw new BadRequestException(
        `Coupon code eligible for amount greater than ${couponCode.minimumAmount}`,
      );
    }

    if (
      couponCode.maxRedemptions &&
      couponCode.redemptionCount >= couponCode.maxRedemptions
    ) {
      this.logger.warn('Coupon code is fully redeemed', {
        code: couponCode.code,
      });
      throw new ConflictException(
        'Coupon code is fully redeemed',
        couponCode.couponCodeId,
      );
    }

    if (couponCode.maxRedemptionPerCustomer) {
      const customerRedemptions = await manager.find(Redemption, {
        where: {
          couponCode: {
            couponCodeId: couponCode.couponCodeId,
          },
          customer: {
            customerId,
          },
        },
      });

      if (
        customerRedemptions.length >= couponCode.maxRedemptionPerCustomer
      ) {
        this.logger.warn('Customer has already redeemed this coupon code');
        throw new ConflictException(
          'Customer has already redeemed this coupon code',
        );
      }
    }
  }

  public calculateDiscount(coupon: Coupon, baseOrderValue: number): number {
    if (!Number.isFinite(baseOrderValue) || baseOrderValue <= 0) {
      throw new BadRequestException('Base order value must be greater than zero');
    }

    const discountValue = Number(coupon.discountValue);
    const discountUpto = coupon.discountUpto == null ? undefined : Number(coupon.discountUpto);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      throw new ConflictException('Coupon has an invalid discount value');
    }
    if (discountUpto !== undefined && (!Number.isFinite(discountUpto) || discountUpto < 0)) {
      throw new ConflictException('Coupon has an invalid discount cap');
    }

    if (coupon.discountType === discountTypeEnum.PERCENTAGE && discountValue > 100) {
      throw new ConflictException('Coupon percentage discount cannot exceed 100');
    }

    let discount = coupon.discountType === discountTypeEnum.PERCENTAGE
      ? baseOrderValue * discountValue / 100
      : discountValue;

    if (discountUpto !== undefined && discountUpto > 0) {
      discount = Math.min(discount, discountUpto);
    }

    discount = Math.min(discount, baseOrderValue);
    if (!Number.isFinite(discount) || discount < 0) {
      throw new ConflictException('Coupon discount calculation failed');
    }
    return Number(discount.toFixed(2));
  }

  private async saveRedemption(
    manager: EntityManager,
    couponCode: CouponCode,
    organizationId: string,
    customerId: string,
    itemId: string,
    baseOrderValue: number,
    discount: number,
    externalId?: string,
  ) {
    const redemptionEntity = manager.create(Redemption, {
      organization: {
        organizationId,
      },
      coupon: {
        couponId: couponCode.coupon.couponId,
      },
      campaign: {
        campaignId: couponCode.campaign.campaignId,
      },
      couponCode: {
        couponCodeId: couponCode.couponCodeId,
      },
      baseOrderValue,
      discount,
      externalId: externalId,
      customer: {
        customerId,
      },
      item: {
        itemId,
      },
    });

    return manager.save(Redemption, redemptionEntity);
  }

  async streamRedemptionReport(
    organizationId: string,
    from?: string,
    to?: string,
  ): Promise<PassThrough> {
    if (!from || !to) {
      throw new BadRequestException('Time period not configured for report');
    }

    const passThrough = new PassThrough();

    // csv-stringify stream
    const csvStream = stringify({
      header: true,
      columns: [
        { key: 'Date', header: 'Date' },
        { key: 'CustomerName', header: 'Customer Name' },
        { key: 'CustomerEmail', header: 'Customer Email' },
        { key: 'Item', header: 'Item' },
        { key: 'Coupon', header: 'Coupon' },
        { key: 'Campaign', header: 'Campaign' },
        { key: 'CouponCode', header: 'Coupon Code' },
        { key: 'GrossSales', header: 'Gross Sales' },
        { key: 'Discount', header: 'Discount' },
        { key: 'NetSales', header: 'Net Sales' },
        { key: 'CustomerID', header: 'Customer ID' },
        { key: 'ItemID', header: 'Item ID' },
        { key: 'RedemptionExternalID', header: 'Redemption External ID' },
      ],
    });

    csvStream.pipe(passThrough);

    // USING CLEAN ALIAS "redemption"
    const dbStream = await this.redemptionsRepository
      .createQueryBuilder('redemption')
      .leftJoin('redemption.couponCode', 'couponCode')
      .leftJoin('redemption.item', 'item')
      .leftJoin('redemption.customer', 'customer')
      .leftJoin('redemption.campaign', 'campaign')
      .leftJoin('redemption.coupon', 'coupon')
      .where('redemption.organization_id = :organizationId', { organizationId })
      .andWhere('redemption.redemption_date BETWEEN :start AND :end', {
        start: from,
        end: to,
      })
      .select([
        'redemption.redemption_id AS redemption_id',
        'redemption.redemption_date AS redemption_date',
        'customer.name AS customer_name',
        'customer.email AS customer_email',
        'customer.customer_id AS customer_id',
        'item.name AS item_name',
        'item.item_id AS item_id',
        'couponCode.code AS coupon_code',
        'coupon.name AS coupon_name',
        'campaign.name AS campaign_name',
        'redemption.base_order_value AS gross_sales',
        'redemption.discount AS discount',
        '(redemption.base_order_value - redemption.discount) AS net_sales',
        'redemption.external_id AS redemption_external_id',
      ])
      .orderBy('redemption.redemption_date', 'ASC')
      .stream();

    // Write CSV rows
    dbStream.on('data', (row: any) => {
      csvStream.write({
        Date: formatDateReport(row.redemption_date),
        CustomerName: row.customer_name,
        CustomerEmail: row.customer_email,
        Item: row.item_name,
        Coupon: row.coupon_name,
        Campaign: row.campaign_name,
        CouponCode: row.coupon_code,
        GrossSales: row.gross_sales,
        Discount: row.discount,
        NetSales: row.net_sales,
        CustomerID: row.customer_id,
        ItemID: row.item_id,
        RedemptionExternalID: row.redemption_external_id,
      });
    });

    dbStream.on('end', () => csvStream.end());

    dbStream.on('error', (err) => {
      csvStream.end();
      passThrough.destroy(err);
    });

    return passThrough;
  }

}
