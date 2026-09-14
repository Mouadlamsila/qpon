import {
  PrimaryGeneratedColumn,
  Entity,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { OrganizationUser } from './organization-user.entity';
import { Coupon } from './coupon.entity';
import { Item } from './item.entity';
import { Customer } from './customer.entity';
import { Redemption } from './redemption.entity';
import { CouponCode } from './coupon-code.entity';
import { Campaign } from './campaign.entity';
import { RestaurantOffer } from './restaurant-offer.entity';

@Entity()
export class Organization {
  @PrimaryGeneratedColumn('uuid', { name: 'organization_id' })
  organizationId: string;

  @Column()
  name: string;

  @Column()
  currency: string;

  @Column({ name: 'external_id', nullable: true })
  externalId: string;

  @Column({ name: 'logo_url', type: 'varchar', nullable: true })
  logoUrl: string | null;

  @Column('text', { nullable: true })
  description: string | null;

  @Column({ name: 'contact_email', type: 'varchar', nullable: true })
  contactEmail: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', nullable: true })
  contactPhone: string | null;

  @CreateDateColumn({
    type: 'timestamp with time zone',
    default: () => `now()`,
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp with time zone',
    default: () => `now()`,
    name: 'updated_at',
  })
  updatedAt: Date;

  @OneToMany(
    () => OrganizationUser,
    (organizationUser) => organizationUser.organization,
  )
  organizationUser: OrganizationUser[];

  @OneToMany(() => Coupon, (coupon) => coupon.organization)
  coupons: Coupon[];

  @OneToMany(() => Campaign, (campaign) => campaign.organization)
  campaigns: Campaign[];

  @OneToMany(() => Item, (item) => item.organization)
  items: Item[];

  @OneToMany(() => CouponCode, (couponCode) => couponCode.organization)
  couponCodes: CouponCode[];

  @OneToMany(() => Customer, (customer) => customer.organization)
  customers: Customer[];

  @OneToMany(() => Redemption, (redemption) => redemption.organization)
  redemptions: Redemption[];

  @OneToMany(() => RestaurantOffer, (offer) => offer.organization)
  restaurantOffers: RestaurantOffer[];
}
