import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase6OrganizationStatus1782833374101 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status_enum') THEN
          CREATE TYPE organization_status_enum AS ENUM ('active', 'suspended');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE organization
        ADD COLUMN IF NOT EXISTS status organization_status_enum NOT NULL DEFAULT 'active'
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_organization_status ON organization (status)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_organization_status`);
    await queryRunner.query(`ALTER TABLE organization DROP COLUMN IF EXISTS status`);
    await queryRunner.query(`DROP TYPE IF EXISTS organization_status_enum`);
  }
}
