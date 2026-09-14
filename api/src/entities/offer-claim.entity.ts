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
import { Customer } from './customer.entity';
import { Organization } from './organization.entity';
import { RestaurantOffer } from './restaurant-offer.entity';
import { offerClaimStatusEnum } from '../enums';
import { Redemption } from './redemption.entity';

@Entity({ name: 'offer_claim' })
@Index('idx_offer_claim_organization_offer', ['organization', 'restaurantOffer'])
@Index('idx_offer_claim_organization_customer', ['organization', 'customer'])
@Index('idx_offer_claim_offer_customer', ['restaurantOffer', 'customer'])
@Index('idx_offer_claim_status_expires_at', ['status', 'expiresAt'])
@Index('uq_offer_claim_active_customer', ['restaurantOffer', 'customer'], {
  unique: true,
  where: "status = 'claimed'",
})
export class OfferClaim {
  @PrimaryGeneratedColumn('uuid', { name: 'claim_id' })
  claimId: string;

  @Column({ name: 'display_code', length: 32 })
  displayCode: string;

  @Column({ name: 'code_lookup_value', length: 32, unique: true })
  codeLookupValue: string;

  @Column({ name: 'retrieval_token_hash', length: 64, unique: true })
  retrievalTokenHash: string;

  @Column({ name: 'retrieval_token_encrypted', type: 'text' })
  retrievalTokenEncrypted: string;

  @Column('enum', {
    enum: offerClaimStatusEnum,
    default: offerClaimStatusEnum.CLAIMED,
  })
  status: offerClaimStatusEnum;

  @Column({ name: 'claimed_at', type: 'timestamp with time zone' })
  claimedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp with time zone' })
  expiresAt: Date;

  @Column({ name: 'redeemed_at', type: 'timestamp with time zone', nullable: true })
  redeemedAt: Date | null;

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

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', referencedColumnName: 'organizationId' })
  organization: Organization;

  @ManyToOne(() => RestaurantOffer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_offer_id', referencedColumnName: 'offerId' })
  restaurantOffer: RestaurantOffer;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id', referencedColumnName: 'customerId' })
  customer: Customer;

  @OneToOne(() => Redemption, (redemption) => redemption.offerClaim)
  redemption: Redemption | null;
}
