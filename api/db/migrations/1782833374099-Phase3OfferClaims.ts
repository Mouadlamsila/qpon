import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3OfferClaims1782833374099 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE customer ALTER COLUMN name DROP NOT NULL`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_customer_organization_normalized_email
      ON customer (organization_id, lower(btrim(email)))
      WHERE status = 'active'
    `);

    await queryRunner.query(`
      CREATE TYPE offer_claim_status_enum AS ENUM ('claimed', 'expired', 'revoked', 'redeemed')
    `);

    await queryRunner.query(`
      CREATE TABLE offer_claim (
        claim_id uuid NOT NULL DEFAULT uuid_generate_v4(),
        display_code varchar(32) NOT NULL,
        code_lookup_value varchar(32) NOT NULL,
        retrieval_token_hash varchar(64) NOT NULL,
        retrieval_token_encrypted text NOT NULL,
        status offer_claim_status_enum NOT NULL DEFAULT 'claimed',
        claimed_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        redeemed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        organization_id uuid NOT NULL,
        restaurant_offer_id uuid NOT NULL,
        customer_id uuid NOT NULL,
        CONSTRAINT pk_offer_claim PRIMARY KEY (claim_id),
        CONSTRAINT uq_offer_claim_code_lookup UNIQUE (code_lookup_value),
        CONSTRAINT uq_offer_claim_retrieval_token_hash UNIQUE (retrieval_token_hash),
        CONSTRAINT fk_offer_claim_organization FOREIGN KEY (organization_id)
          REFERENCES organization (organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_offer_claim_offer FOREIGN KEY (restaurant_offer_id)
          REFERENCES restaurant_offer (offer_id) ON DELETE CASCADE,
        CONSTRAINT fk_offer_claim_customer FOREIGN KEY (customer_id)
          REFERENCES customer (customer_id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_offer_claim_organization_offer
      ON offer_claim (organization_id, restaurant_offer_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_offer_claim_organization_customer
      ON offer_claim (organization_id, customer_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_offer_claim_offer_customer
      ON offer_claim (restaurant_offer_id, customer_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_offer_claim_status_expires_at
      ON offer_claim (status, expires_at)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_offer_claim_active_customer
      ON offer_claim (restaurant_offer_id, customer_id)
      WHERE status = 'claimed'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS offer_claim`);
    await queryRunner.query(`DROP TYPE IF EXISTS offer_claim_status_enum`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_customer_organization_normalized_email`);
    await queryRunner.query(`ALTER TABLE customer ALTER COLUMN name SET NOT NULL`);
  }
}
