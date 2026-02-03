# Claude.md - UniMate Backend Development Guide

This document provides essential context for AI assistants working on the UniMate backend codebase.

## Project Overview

**UniMate Backend** is a NestJS-based REST API for managing university timetables, announcements, and notifications. It was migrated from Firebase Cloud Functions to a self-hosted NestJS application with PostgreSQL.

### Core Purpose

- **Timetable Management**: Upload, parse, and manage university class schedules
- **User Management**: Role-based access control with department scoping
- **Announcements**: Department-specific announcements with image support
- **Push Notifications**: Direct APNs (iOS) and FCM (Android) integration
- **File Storage**: AWS S3 integration for timetable files and announcement images

## Architecture

### Technology Stack

- **Framework**: NestJS 10.x
- **Database**: PostgreSQL 16 (via TypeORM)
- **Queue System**: Bull (Redis-backed) for async notification processing
- **Storage**: AWS S3
- **Authentication**: JWT with custom auth service
- **Push Notifications**: Direct APNs and FCM HTTP v1 API (no Firebase SDK)

### Project Structure

```
src/
├── common/              # Shared utilities, guards, decorators, filters
│   ├── decorators/      # Custom decorators (access-level, department-access)
│   ├── guards/         # Auth guards (JWT, access-level, department-access)
│   ├── filters/        # Exception filters
│   ├── interceptors/   # Request/response interceptors
│   ├── pipes/          # Validation pipes
│   └── utils/         # Utility functions (access-control)
├── config/             # Configuration management (Doppler support)
├── database/           # Database entities, migrations, data source
│   ├── entities/       # TypeORM entities
│   └── migrations/     # Database migrations
└── modules/            # Feature modules
    ├── auth/           # Authentication & JWT
    ├── user/           # User account management
    ├── account-approval/ # Pending account approval workflow
    ├── department/     # Department CRUD + AvailableOptions
    ├── timetable/      # Timetable upload, parsing, management
    ├── announcement/   # Announcement CRUD
    ├── notification/   # Push notifications (APNs, FCM, Bull queues)
    ├── storage/        # AWS S3 file storage
    └── cleaning/       # Data cleanup utilities
```

## Key Concepts

### Access Control System

**Access Levels** (hierarchical):

- `SUPER`: Full system access
- `SUPREME`: Multi-department admin
- `HEAD`: Single department admin
- `MULTI`: Multi-department user
- `CUSTODIAN`: Single department user

**Department Scoping**:

- Users have `departmentId` (single) or `departmentIds` (multiple)
- Guards enforce department access: `@RequireDepartmentAccess('departmentId')`
- Access level guards: `@RequireAccessLevel(AccessLevel.SUPER, AccessLevel.SUPREME)`

### Timetable Processing Flow

1. **Upload**: Excel file uploaded via Multer (memory storage)
2. **Conversion**: Excel → CSV using `xlsx` library
3. **Parsing**: Rule-based parser extracts classes, teachers, courses
4. **Validation**: Identifies skipped classes (missing day/room/time)
5. **Storage**: Saves to PostgreSQL + uploads original file to S3
6. **Options Update**: Updates `AvailableOptions` entity with courses/semesters/sections/teachers
7. **Notifications**: Sends push notifications to all users (via Bull queue)

### Notification System

**Architecture**: Hybrid approach (Redis/Bull → future Kafka migration path)

**Components**:

- `NotificationQueueService`: Bull queue management
- `NotificationWorkerService`: Processes jobs from queues
- `PushNotificationService`: Unified abstraction (delegates to APNs/FCM)
- `APNsService`: Direct Apple Push Notification service (JWT auth)
- `FCMService`: Direct Firebase Cloud Messaging HTTP v1 API
- `NotificationLogService`: Logs all notification attempts

**Queue Types**:

- `timetable-notifications`: Timetable update notifications
- `custom-notifications`: Custom notification broadcasts
- `announcement-notifications`: Announcement notifications

### Database Entities

**Core Entities**:

- `User`: User accounts with access levels and department associations
- `Department`: Department information
- `AvailableOptions`: Courses, semesters, sections, teachers per department
- `Timetable`: Parsed timetable data (JSONB)
- `TimetableHistory`: Processing history with steps, anomalies, clashes
- `Announcement`: Department announcements with images
- `Device`: Push notification device tokens
- `NotificationLog`: Notification delivery tracking
- `PendingAccount`: Accounts awaiting approval

## Development Guidelines

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured with Prettier
- **No `eslint-disable`**: Use proper type definitions instead
- **Naming**: PascalCase for classes, camelCase for functions/variables

### Module Pattern

Each feature module follows NestJS conventions:

```
module-name/
├── dto/              # Data Transfer Objects (validation)
├── interfaces/       # TypeScript interfaces
├── services/         # Business logic
├── controllers/      # HTTP endpoints
└── module-name.module.ts
```

### Error Handling

- Use NestJS built-in exceptions: `BadRequestException`, `NotFoundException`, `ForbiddenException`
- Global exception filter: `AllExceptionsFilter`
- Always validate department access before operations

### Database Migrations

- Use TypeORM migrations: `npm run migration:generate`
- Migration files: `src/database/migrations/`
- Run migrations: `npm run migration:run`

### Testing

- Unit tests: `npm test`
- E2E tests: `npm run test:e2e`
- Test files: `*.spec.ts` alongside source files

## Common Tasks

### Adding a New Endpoint

1. Create DTO in `dto/` folder with class-validator decorators
2. Add service method in `service-name.service.ts`
3. Add controller method with appropriate guards
4. Use `@RequireDepartmentAccess()` if department-scoped
5. Use `@RequireAccessLevel()` if access-level restricted

### Adding a New Entity

1. Create entity in `database/entities/`
2. Add to `DatabaseModule` imports
3. Generate migration: `npm run migration:generate`
4. Review and run migration: `npm run migration:run`

### Adding Push Notification Support

1. Add job to appropriate queue in `NotificationQueueService`
2. Worker automatically processes via `NotificationWorkerService`
3. Logging handled by `NotificationLogService`

## Environment Variables

Key environment variables (see `.env.example`):

- `DATABASE_*`: PostgreSQL connection
- `REDIS_*`: Redis connection for Bull
- `JWT_SECRET`: JWT signing secret
- `AWS_*`: S3 configuration
- `APNS_*`: Apple Push Notification service config
- `FCM_*`: Firebase Cloud Messaging config
- `SMTP_*` / `POSTMARK_*`: Email service config

## Important Notes

1. **No Firebase Dependencies**: All Firebase services replaced with custom implementations
2. **Direct Push Notifications**: APNs and FCM use direct HTTP APIs, not SDKs
3. **Type Safety**: Avoid `any` types; use proper interfaces
4. **Access Control**: Always validate department access in service methods
5. **File Uploads**: Use Multer with memory storage, then upload to S3
6. **Async Processing**: Use Bull queues for notifications, not direct calls

## Migration History

This backend was migrated from:

- **Firebase Cloud Functions** → **NestJS**
- **Firestore** → **PostgreSQL**
- **Firebase Auth** → **Custom JWT Auth**
- **Firebase Cloud Messaging SDK** → **Direct FCM HTTP v1 API**
- **Firebase Storage** → **AWS S3**

All Firebase dependencies have been removed.

## Resources

- **NestJS Docs**: https://docs.nestjs.com
- **TypeORM Docs**: https://typeorm.io
- **Bull Queue Docs**: https://github.com/OptimalBits/bull
- **AWS S3 SDK**: https://docs.aws.amazon.com/sdk-for-javascript/
