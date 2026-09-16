import { MigrationInterface, QueryRunner } from 'typeorm';

export class OfferDeliveryOptions1782833374102 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE restaurant_offer
        ADD COLUMN IF NOT EXISTS delivery_available boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS delivery_zones text[] NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE restaurant_offer DROP COLUMN IF EXISTS delivery_zones`);
    await queryRunner.query(`ALTER TABLE restaurant_offer DROP COLUMN IF EXISTS delivery_available`);
  }
}
