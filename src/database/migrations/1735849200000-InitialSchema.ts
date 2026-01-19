import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1735849200000 implements MigrationInterface {
  name = 'InitialSchema1735849200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create OAuthProvider enum type
    await queryRunner.query(`
      CREATE TYPE "oauth_provider_enum" AS ENUM('local')
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password" character varying,
        "name" character varying,
        "avatar" character varying,
        "provider" "oauth_provider_enum" NOT NULL DEFAULT 'local',
        "providerId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastLoginAt" TIMESTAMP,
        "refreshTokenCreatedAt" TIMESTAMP,
        "refreshToken" character varying,
        "refreshTokenExpireAt" TIMESTAMP,
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_providerId" UNIQUE ("providerId"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create index on email for faster lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_users_email" ON "users" ("email")
    `);

    // Create otp_verifications table
    await queryRunner.query(`
      CREATE TABLE "otp_verifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "otpHash" character varying NOT NULL,
        "name" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMP NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        CONSTRAINT "UQ_otp_verifications_email" UNIQUE ("email"),
        CONSTRAINT "PK_otp_verifications" PRIMARY KEY ("id")
      )
    `);

    // Create index on email for faster lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_otp_verifications_email" ON "otp_verifications" ("email")
    `);

    // Create password_resets table
    await queryRunner.query(`
      CREATE TABLE "password_resets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "token" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMP NOT NULL,
        "used" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_password_resets" PRIMARY KEY ("id")
      )
    `);

    // Create index on email for faster lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_password_resets_email" ON "password_resets" ("email")
    `);

    // Create index on expiresAt for cleanup queries
    await queryRunner.query(`
      CREATE INDEX "IDX_password_resets_expiresAt" ON "password_resets" ("expiresAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_password_resets_expiresAt"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_password_resets_email"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_otp_verifications_email"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "password_resets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "otp_verifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    // Drop enum type
    await queryRunner.query(`DROP TYPE IF EXISTS "oauth_provider_enum"`);
  }
}
