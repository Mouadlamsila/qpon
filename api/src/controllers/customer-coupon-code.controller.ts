import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { CustomerCouponCodeService } from '../services/customer-coupon-code.service';
import { LoggerService } from '../services/logger.service';
import {
  CreateCustomerCouponCodeDto,
  UpdateCustomerCouponCodeDto,
} from 'src/dtos/customer-coupon-code.dto';
import { Permissions } from '../decorators/permission.decorator';
import { CustomerCouponCode } from '../entities/customer-coupon-code.entity';

@ApiTags('Customer coupon code')
@Controller(
  '/organizations/:organization_id/coupons/:coupon_id/campaigns/:campaign_id/coupon-codes/:coupon_code_id/customers',
)
export class CustomerCouponCodeController {
  constructor(
    private customerCouponCodeService: CustomerCouponCodeService,
    private logger: LoggerService,
  ) {}

  /**
   * Add customers to coupon code
   */
  @ApiResponse({ status: 200, description: 'Successful response' })
  @Permissions('create', CustomerCouponCode)
  @Post()
  async addCustomers(
    @Param('organization_id') organizationId: string,
    @Param('coupon_id') couponId: string,
    @Param('campaign_id') campaignId: string,
    @Param('coupon_code_id') couponCodeId: string,
    @Body() body: CreateCustomerCouponCodeDto,
  ) {
    this.logger.info('START: addCustomers constroller');

    const result = await this.customerCouponCodeService.addCustomers(
      organizationId,
      couponId,
      campaignId,
      couponCodeId,
      body,
    );

    this.logger.info('END: addCustomers controller');
    return { message: 'Successfully added customers to coupon code', result };
  }

  /**
   * Fetch customers for a coupon code
   */
  @ApiResponse({ status: 200, description: 'Successful response' })
  @Permissions('read', CustomerCouponCode)
  @Get()
  async fetchCustomers(
    @Param('organization_id') organizationId: string,
    @Param('coupon_id') couponId: string,
    @Param('campaign_id') campaignId: string,
    @Param('coupon_code_id') couponCodeId: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    this.logger.info('START: fetchCustomers controller');

    const result = await this.customerCouponCodeService.fetchCustomers(
      organizationId,
      couponId,
      campaignId,
      couponCodeId,
      skip,
      take,
    );

    this.logger.info('END: fetchCustomers controller');
    return {
      message: 'Successfully fetched customers for coupon code',
      result,
    };
  }

  /**
   * Update customers
   */
  @ApiResponse({ status: 200, description: 'Successful response' })
  @Permissions('update', CustomerCouponCode)
  @Patch()
  async updateCustomers(
    @Param('organization_id') organizationId: string,
    @Param('coupon_id') couponId: string,
    @Param('campaign_id') campaignId: string,
    @Param('coupon_code_id') couponCodeId: string,
    @Body() body: UpdateCustomerCouponCodeDto,
  ) {
    this.logger.info('START: updateCustomers controller');

    const result = await this.customerCouponCodeService.updateCustomers(
      organizationId,
      couponId,
      campaignId,
      couponCodeId,
      body,
    );

    this.logger.info('END: updateCustomers controller');
    return {
      message: 'Successfully updated customers for coupon code',
      result,
    };
  }

  /**
   * Remove a customer from coupon code
   */
  @ApiResponse({ status: 200, description: 'Successful response' })
  @Permissions('delete', CustomerCouponCode)
  @Delete(':customer_id')
  async removeCustomer(
    @Param('organization_id') organizationId: string,
    @Param('coupon_id') couponId: string,
    @Param('campaign_id') campaignId: string,
    @Param('coupon_code_id') couponCodeId: string,
    @Param('customer_id') customerId: string,
  ) {
    this.logger.info('START: removeCustomer controller');

    const result = await this.customerCouponCodeService.removeCustomer(
      organizationId,
      couponId,
      campaignId,
      couponCodeId,
      customerId,
    );

    this.logger.info('END: removeCustomer controller');
    return {
      message: 'Successfully removed customer from coupon code',
      result,
    };
  }
}
