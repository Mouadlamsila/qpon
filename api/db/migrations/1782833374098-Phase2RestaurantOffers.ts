import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase2RestaurantOffers1782833374098 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE organization
        ADD COLUMN IF NOT EXISTS logo_url varchar,
        ADD COLUMN IF NOT EXISTS description text,
        ADD COLUMN IF NOT EXISTS contact_email varchar,
        ADD COLUMN IF NOT EXISTS contact_phone varchar
    `);

    await queryRunner.query(`
      CREATE TYPE offer_publication_status_enum AS ENUM ('draft', 'published', 'paused', 'expired', 'archived')
    `);

    await queryRunner.query(`
      CREATE TABLE restaurant_offer (
        offer_id uuid NOT NULL DEFAULT uuid_generate_v4(),
        title varchar(120) NOT NULL,
        description text,
        image_url varchar,
        public_slug varchar(180) NOT NULL,
        publication_status offer_publication_status_enum NOT NULL DEFAULT 'draft',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        organization_id uuid NOT NULL,
        coupon_id uuid NOT NULL,
        CONSTRAINT pk_restaurant_offer PRIMARY KEY (offer_id),
        CONSTRAINT uq_restaurant_offer_public_slug UNIQUE (public_slug),
        CONSTRAINT uq_restaurant_offer_coupon UNIQUE (coupon_id),
        CONSTRAINT fk_restaurant_offer_organization FOREIGN KEY (organization_id)
          REFERENCES organization (organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_restaurant_offer_coupon_same_organization FOREIGN KEY (coupon_id, organization_id)
          REFERENCES coupon (coupon_id, organization_id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_restaurant_offer_organization ON restaurant_offer (organization_id)`);
    await queryRunner.query(`CREATE INDEX idx_restaurant_offer_publication_status ON restaurant_offer (publication_status)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS restaurant_offer`);
    await queryRunner.query(`DROP TYPE IF EXISTS offer_publication_status_enum`);
    await queryRunner.query(`ALTER TABLE organization DROP COLUMN IF EXISTS contact_phone`);
    await queryRunner.query(`ALTER TABLE organization DROP COLUMN IF EXISTS contact_email`);
    await queryRunner.query(`ALTER TABLE organization DROP COLUMN IF EXISTS description`);
    await queryRunner.query(`ALTER TABLE organization DROP COLUMN IF EXISTS logo_url`);
  }
}
