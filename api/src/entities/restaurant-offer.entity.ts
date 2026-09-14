import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Coupon } from './coupon.entity';
import { offerPublicationStatusEnum } from '../enums';

@Entity({ name: 'restaurant_offer' })
@Index('uq_restaurant_offer_public_slug', ['publicSlug'], { unique: true })
export class RestaurantOffer {
  @PrimaryGeneratedColumn('uuid', { name: 'offer_id' })
  offerId: string;

  @Column({ length: 120 })
  title: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ name: 'public_slug', length: 180 })
  publicSlug: string;

  @Column('enum', {
    name: 'publication_status',
    enum: offerPublicationStatusEnum,
    default: offerPublicationStatusEnum.DRAFT,
  })
  publicationStatus: offerPublicationStatusEnum;

  @CreateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'now()',
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'now()',
    name: 'updated_at',
  })
  updatedAt: Date;

  @ManyToOne(() => Organization, (organization) => organization.restaurantOffers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id', referencedColumnName: 'organizationId' })
  organization: Organization;

  @OneToOne(() => Coupon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'coupon_id', referencedColumnName: 'couponId' })
  coupon: Coupon;
}
