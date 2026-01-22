import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Only run migrations automatically if enabled via environment variable
    // This allows you to disable auto-migrations in certain environments if needed
    const autoRunMigrations =
      this.configService.get<boolean>('autoRunMigrations') ?? true;

    if (!autoRunMigrations) {
      this.logger.log('Auto-running migrations is disabled');
      return;
    }

    try {
      this.logger.log('Running database migrations...');

      // Run pending migrations (TypeORM will only run migrations that haven't been executed)
      const executedMigrations = await this.dataSource.runMigrations({
        transaction: 'all',
      });

      if (executedMigrations.length > 0) {
        this.logger.log(
          `Successfully executed ${executedMigrations.length} migration(s):`,
        );
        executedMigrations.forEach((migration) => {
          this.logger.log(`  - ${migration.name}`);
        });
      } else {
        this.logger.log('All migrations are up to date');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error('Failed to run migrations:', errorMessage);
      if (errorStack) {
        this.logger.debug('Migration error stack:', errorStack);
      }

      // Check if it's a known "already exists" error that we can safely ignore
      // (This can happen if migrations were partially run before)
      const isDuplicateError =
        errorMessage.includes('already exists') ||
        errorMessage.includes('duplicate_object');

      if (isDuplicateError) {
        this.logger.warn(
          'Migration encountered "already exists" error. This may indicate the migration was partially applied. The migration has been made idempotent and should succeed on retry.',
        );
        // Don't throw - allow the app to start, but log a warning
        // The idempotent migration should handle this gracefully
      } else {
        // For other errors, fail fast in production
        const nodeEnv = this.configService.get<string>('nodeEnv');
        if (nodeEnv === 'production') {
          this.logger.error(
            'Migration failed in production. Exiting application.',
          );
          process.exit(1);
        } else {
          this.logger.warn(
            'Migration failed in non-production environment. Application will continue, but database may be in an inconsistent state.',
          );
        }
      }
    }
  }
}
