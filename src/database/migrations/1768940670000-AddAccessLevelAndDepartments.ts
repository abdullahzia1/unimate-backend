import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccessLevelAndDepartments1768940670000 implements MigrationInterface {
  name = 'AddAccessLevelAndDepartments1768940670000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create AccessLevel enum type
    await queryRunner.query(`
      CREATE TYPE "access_level_enum" AS ENUM('super', 'supreme', 'head', 'multi', 'custodian')
    `);

    // Create UserStatus enum type
    await queryRunner.query(`
      CREATE TYPE "user_status_enum" AS ENUM('active', 'inactive', 'pending')
    `);

    // Create DepartmentStatus enum type
    await queryRunner.query(`
      CREATE TYPE "department_status_enum" AS ENUM('active', 'inactive')
    `);

    // Create PendingAccountStatus enum type
    await queryRunner.query(`
      CREATE TYPE "pending_account_status_enum" AS ENUM('pending', 'approved', 'rejected')
    `);

    // Add new columns to users table
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "accessLevel" "access_level_enum",
      ADD COLUMN "departmentId" character varying,
      ADD COLUMN "departmentIds" text[],
      ADD COLUMN "status" "user_status_enum" NOT NULL DEFAULT 'active',
      ADD COLUMN "phone" character varying,
      ADD COLUMN "createdBy" character varying,
      ADD COLUMN "approvedBy" character varying,
      ADD COLUMN "approvedAt" TIMESTAMP
    `);

    // Create index on accessLevel for faster lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_users_accessLevel" ON "users" ("accessLevel")
    `);

    // Create index on departmentId for faster lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_users_departmentId" ON "users" ("departmentId")
    `);

    // Create departments table
    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id" character varying NOT NULL,
        "name" character varying NOT NULL,
        "code" character varying NOT NULL,
        "description" character varying,
        "color" character varying,
        "status" "department_status_enum" NOT NULL DEFAULT 'active',
        "createdBy" character varying,
        "lastTimetableUpdate" TIMESTAMP,
        "currentTimetableHistoryId" character varying,
        "currentTimetableUpdatedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_departments" PRIMARY KEY ("id")
      )
    `);

    // Create index on departments code for faster lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_departments_code" ON "departments" ("code")
    `);

    // Create index on departments status for faster lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_departments_status" ON "departments" ("status")
    `);

    // Create timetables table
    await queryRunner.query(`
      CREATE TABLE "timetables" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "departmentId" character varying NOT NULL,
        "data" jsonb NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "createdBy" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_timetables" PRIMARY KEY ("id")
      )
    `);

    // Create index on timetables departmentId
    await queryRunner.query(`
      CREATE INDEX "IDX_timetables_departmentId" ON "timetables" ("departmentId")
    `);

    // Create timetable_history table
    await queryRunner.query(`
      CREATE TABLE "timetable_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "departmentId" character varying NOT NULL,
        "version" integer,
        "fileName" character varying,
        "status" character varying,
        "processingSteps" jsonb,
        "anomalies" jsonb,
        "clashes" jsonb,
        "uploadedBy" character varying,
        "uploadedByName" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_timetable_history" PRIMARY KEY ("id")
      )
    `);

    // Create index on timetable_history departmentId
    await queryRunner.query(`
      CREATE INDEX "IDX_timetable_history_departmentId" ON "timetable_history" ("departmentId")
    `);

    // Create announcements table
    await queryRunner.query(`
      CREATE TABLE "announcements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "publisherName" character varying NOT NULL,
        "publisherIcon" character varying NOT NULL,
        "publisherIconUrl" character varying,
        "text" text NOT NULL,
        "imageUrls" text[] NOT NULL DEFAULT '{}',
        "isPinned" boolean NOT NULL DEFAULT false,
        "verified" boolean NOT NULL DEFAULT false,
        "targetDepartmentIds" text[] NOT NULL,
        "createdBy" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_announcements" PRIMARY KEY ("id")
      )
    `);

    // Create index on announcements targetDepartmentIds (using GIN for array search)
    await queryRunner.query(`
      CREATE INDEX "IDX_announcements_targetDepartmentIds" ON "announcements" USING GIN ("targetDepartmentIds")
    `);

    // Create devices table
    await queryRunner.query(`
      CREATE TABLE "devices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "token" character varying NOT NULL,
        "platform" character varying,
        "departmentId" character varying,
        "lastActiveAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_devices" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_devices_userId_token" UNIQUE ("userId", "token")
      )
    `);

    // Create indexes on devices
    await queryRunner.query(`
      CREATE INDEX "IDX_devices_userId" ON "devices" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_devices_departmentId" ON "devices" ("departmentId")
    `);

    // Create pending_accounts table
    await queryRunner.query(`
      CREATE TABLE "pending_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "uid" character varying NOT NULL,
        "email" character varying NOT NULL,
        "name" character varying NOT NULL,
        "phone" character varying,
        "requestedAccessLevel" "access_level_enum" NOT NULL,
        "requestedDepartmentId" character varying,
        "status" "pending_account_status_enum" NOT NULL DEFAULT 'pending',
        "approvedBy" character varying,
        "approvedAt" TIMESTAMP,
        "rejectedBy" character varying,
        "rejectedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_pending_accounts_uid" UNIQUE ("uid"),
        CONSTRAINT "UQ_pending_accounts_email" UNIQUE ("email"),
        CONSTRAINT "PK_pending_accounts" PRIMARY KEY ("id")
      )
    `);

    // Create index on pending_accounts status
    await queryRunner.query(`
      CREATE INDEX "IDX_pending_accounts_status" ON "pending_accounts" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_pending_accounts_status"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_departmentId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_userId"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_announcements_targetDepartmentIds"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_timetable_history_departmentId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_timetables_departmentId"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_departments_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_departments_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_departmentId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_accessLevel"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "pending_accounts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "devices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "announcements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "timetable_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "timetables"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "departments"`);

    // Remove columns from users table
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "accessLevel",
      DROP COLUMN IF EXISTS "departmentId",
      DROP COLUMN IF EXISTS "departmentIds",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "phone",
      DROP COLUMN IF EXISTS "createdBy",
      DROP COLUMN IF EXISTS "approvedBy",
      DROP COLUMN IF EXISTS "approvedAt"
    `);

    // Drop enum types
    await queryRunner.query(
      `DROP TYPE IF EXISTS "pending_account_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "department_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "access_level_enum"`);
  }
}
