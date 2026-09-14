import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase4MerchantClaimRedemption1782833374100 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE redemption
        ADD COLUMN offer_claim_id uuid,
        ADD COLUMN redeemed_by_user_id uuid,
        ADD COLUMN redeemed_at timestamptz
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_redemption_offer_claim
      ON redemption (offer_claim_id)
      WHERE offer_claim_id IS NOT NULL
    `);
    await queryRunner.query(`CREATE INDEX idx_redemption_offer_claim ON redemption (offer_claim_id)`);
    await queryRunner.query(`CREATE INDEX idx_redemption_redeemed_at ON redemption (organization_id, redeemed_at)`);
    await queryRunner.query(`CREATE INDEX idx_offer_claim_organization_code ON offer_claim (organization_id, code_lookup_value)`);

    await queryRunner.query(`
      ALTER TABLE redemption
        ADD CONSTRAINT fk_redemption_offer_claim
          FOREIGN KEY (offer_claim_id) REFERENCES offer_claim (claim_id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_redemption_redeemed_by_user
          FOREIGN KEY (redeemed_by_user_id) REFERENCES "user" (user_id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_restaurant_offer_id_organization
      ON restaurant_offer (offer_id, organization_id)
    `);
    await queryRunner.query(`
      ALTER TABLE offer_claim
        ADD CONSTRAINT fk_offer_claim_offer_same_organization
          FOREIGN KEY (restaurant_offer_id, organization_id)
          REFERENCES restaurant_offer (offer_id, organization_id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_offer_claim_customer_same_organization
          FOREIGN KEY (customer_id, organization_id)
          REFERENCES customer (customer_id, organization_id) ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE offer_claim DROP CONSTRAINT IF EXISTS fk_offer_claim_customer_same_organization`);
    await queryRunner.query(`ALTER TABLE offer_claim DROP CONSTRAINT IF EXISTS fk_offer_claim_offer_same_organization`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_restaurant_offer_id_organization`);
    await queryRunner.query(`ALTER TABLE redemption DROP CONSTRAINT IF EXISTS fk_redemption_redeemed_by_user`);
    await queryRunner.query(`ALTER TABLE redemption DROP CONSTRAINT IF EXISTS fk_redemption_offer_claim`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_offer_claim_organization_code`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_redemption_redeemed_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_redemption_offer_claim`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_redemption_offer_claim`);
    await queryRunner.query(`ALTER TABLE redemption DROP COLUMN IF EXISTS redeemed_at, DROP COLUMN IF EXISTS redeemed_by_user_id, DROP COLUMN IF EXISTS offer_claim_id`);
  }
}
