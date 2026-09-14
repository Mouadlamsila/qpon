import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 integrity hardening. The duplicate checks deliberately fail the
 * migration instead of silently changing existing business data.
 */
export class Phase1Hardening1782833374097 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM coupon_code
          WHERE status <> 'archive'
          GROUP BY organization_id, lower(code)
          HAVING COUNT(*) > 1
        ) THEN RAISE EXCEPTION 'Duplicate active coupon codes exist'; END IF;
        IF EXISTS (
          SELECT 1 FROM customer
          WHERE external_id IS NOT NULL AND status = 'active'
          GROUP BY organization_id, external_id
          HAVING COUNT(*) > 1
        ) THEN RAISE EXCEPTION 'Duplicate active customer external IDs exist'; END IF;
        IF EXISTS (
          SELECT 1 FROM item
          WHERE external_id IS NOT NULL AND status = 'active'
          GROUP BY organization_id, external_id
          HAVING COUNT(*) > 1
        ) THEN RAISE EXCEPTION 'Duplicate active item external IDs exist'; END IF;
        IF EXISTS (
          SELECT 1 FROM redemption
          WHERE external_id IS NOT NULL
          GROUP BY organization_id, external_id
          HAVING COUNT(*) > 1
        ) THEN RAISE EXCEPTION 'Duplicate redemption external IDs exist'; END IF;
      END $$;
    `);

    await queryRunner.query(`ALTER TABLE coupon ALTER COLUMN organization_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE campaign ALTER COLUMN organization_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE coupon_code ALTER COLUMN organization_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE customer ALTER COLUMN organization_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE item ALTER COLUMN organization_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE redemption ALTER COLUMN organization_id SET NOT NULL`);

    await queryRunner.query(`ALTER TABLE coupon ADD CONSTRAINT chk_coupon_discount_value_positive CHECK (discount_value > 0)`);
    await queryRunner.query(`ALTER TABLE coupon ADD CONSTRAINT chk_coupon_percentage_max CHECK (discount_type <> 'percentage' OR discount_value <= 100)`);
    await queryRunner.query(`ALTER TABLE coupon_code ADD CONSTRAINT chk_coupon_code_counts_nonnegative CHECK (redemption_count >= 0 AND (max_redemptions IS NULL OR max_redemptions > 0) AND (max_redemption_per_customer IS NULL OR max_redemption_per_customer > 0))`);
    await queryRunner.query(`ALTER TABLE redemption ADD CONSTRAINT chk_redemption_amounts_valid CHECK (base_order_value > 0 AND discount >= 0 AND discount <= base_order_value)`);

    await queryRunner.query(`CREATE UNIQUE INDEX uq_coupon_code_org_lower_code ON coupon_code (organization_id, lower(code)) WHERE status <> 'archive'`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_customer_org_external_id_active ON customer (organization_id, external_id) WHERE external_id IS NOT NULL AND status = 'active'`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_item_org_external_id_active ON item (organization_id, external_id) WHERE external_id IS NOT NULL AND status = 'active'`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_redemption_org_external_id ON redemption (organization_id, external_id) WHERE external_id IS NOT NULL`);

    await queryRunner.query(`ALTER TABLE coupon ADD CONSTRAINT uq_coupon_id_organization UNIQUE (coupon_id, organization_id)`);
    await queryRunner.query(`ALTER TABLE campaign ADD CONSTRAINT uq_campaign_id_organization UNIQUE (campaign_id, organization_id)`);
    await queryRunner.query(`ALTER TABLE coupon_code ADD CONSTRAINT uq_coupon_code_id_organization UNIQUE (coupon_code_id, organization_id)`);
    await queryRunner.query(`ALTER TABLE customer ADD CONSTRAINT uq_customer_id_organization UNIQUE (customer_id, organization_id)`);
    await queryRunner.query(`ALTER TABLE item ADD CONSTRAINT uq_item_id_organization UNIQUE (item_id, organization_id)`);

    await queryRunner.query(`ALTER TABLE campaign ADD CONSTRAINT fk_campaign_coupon_same_organization FOREIGN KEY (coupon_id, organization_id) REFERENCES coupon (coupon_id, organization_id)`);
    await queryRunner.query(`ALTER TABLE coupon_code ADD CONSTRAINT fk_coupon_code_coupon_same_organization FOREIGN KEY (coupon_id, organization_id) REFERENCES coupon (coupon_id, organization_id)`);
    await queryRunner.query(`ALTER TABLE coupon_code ADD CONSTRAINT fk_coupon_code_campaign_same_organization FOREIGN KEY (campaign_id, organization_id) REFERENCES campaign (campaign_id, organization_id)`);
    await queryRunner.query(`ALTER TABLE redemption ADD CONSTRAINT fk_redemption_coupon_code_same_organization FOREIGN KEY (coupon_code_id, organization_id) REFERENCES coupon_code (coupon_code_id, organization_id)`);
    await queryRunner.query(`ALTER TABLE redemption ADD CONSTRAINT fk_redemption_campaign_same_organization FOREIGN KEY (campaign_id, organization_id) REFERENCES campaign (campaign_id, organization_id)`);
    await queryRunner.query(`ALTER TABLE redemption ADD CONSTRAINT fk_redemption_coupon_same_organization FOREIGN KEY (coupon_id, organization_id) REFERENCES coupon (coupon_id, organization_id)`);
    await queryRunner.query(`ALTER TABLE redemption ADD CONSTRAINT fk_redemption_customer_same_organization FOREIGN KEY (customer_id, organization_id) REFERENCES customer (customer_id, organization_id)`);
    await queryRunner.query(`ALTER TABLE redemption ADD CONSTRAINT fk_redemption_item_same_organization FOREIGN KEY (item_id, organization_id) REFERENCES item (item_id, organization_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE redemption DROP CONSTRAINT IF EXISTS fk_redemption_item_same_organization`);
    await queryRunner.query(`ALTER TABLE redemption DROP CONSTRAINT IF EXISTS fk_redemption_customer_same_organization`);
    await queryRunner.query(`ALTER TABLE redemption DROP CONSTRAINT IF EXISTS fk_redemption_coupon_same_organization`);
    await queryRunner.query(`ALTER TABLE redemption DROP CONSTRAINT IF EXISTS fk_redemption_campaign_same_organization`);
    await queryRunner.query(`ALTER TABLE redemption DROP CONSTRAINT IF EXISTS fk_redemption_coupon_code_same_organization`);
    await queryRunner.query(`ALTER TABLE coupon_code DROP CONSTRAINT IF EXISTS fk_coupon_code_campaign_same_organization`);
    await queryRunner.query(`ALTER TABLE coupon_code DROP CONSTRAINT IF EXISTS fk_coupon_code_coupon_same_organization`);
    await queryRunner.query(`ALTER TABLE campaign DROP CONSTRAINT IF EXISTS fk_campaign_coupon_same_organization`);
    await queryRunner.query(`ALTER TABLE item DROP CONSTRAINT IF EXISTS uq_item_id_organization`);
    await queryRunner.query(`ALTER TABLE customer DROP CONSTRAINT IF EXISTS uq_customer_id_organization`);
    await queryRunner.query(`ALTER TABLE coupon_code DROP CONSTRAINT IF EXISTS uq_coupon_code_id_organization`);
    await queryRunner.query(`ALTER TABLE campaign DROP CONSTRAINT IF EXISTS uq_campaign_id_organization`);
    await queryRunner.query(`ALTER TABLE coupon DROP CONSTRAINT IF EXISTS uq_coupon_id_organization`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_redemption_org_external_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_item_org_external_id_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_customer_org_external_id_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_coupon_code_org_lower_code`);
    await queryRunner.query(`ALTER TABLE redemption DROP CONSTRAINT IF EXISTS chk_redemption_amounts_valid`);
    await queryRunner.query(`ALTER TABLE coupon_code DROP CONSTRAINT IF EXISTS chk_coupon_code_counts_nonnegative`);
    await queryRunner.query(`ALTER TABLE coupon DROP CONSTRAINT IF EXISTS chk_coupon_percentage_max`);
    await queryRunner.query(`ALTER TABLE coupon DROP CONSTRAINT IF EXISTS chk_coupon_discount_value_positive`);
    await queryRunner.query(`ALTER TABLE redemption ALTER COLUMN organization_id DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE item ALTER COLUMN organization_id DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE customer ALTER COLUMN organization_id DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE coupon_code ALTER COLUMN organization_id DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE campaign ALTER COLUMN organization_id DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE coupon ALTER COLUMN organization_id DROP NOT NULL`);
  }
}
