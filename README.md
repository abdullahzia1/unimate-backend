# UniMate Backend

A comprehensive NestJS backend API for managing university timetables, announcements, and push notifications. This system provides role-based access control, automated timetable parsing, and real-time notifications for students, teachers, and administrators.

## 🎯 Project Overview

**UniMate Backend** is a RESTful API service that powers a university timetable management system. It handles:

- **Timetable Management**: Upload Excel/CSV files, parse complex schedules, and manage class data
- **User Management**: Role-based access control with department scoping
- **Announcements**: Department-specific announcements with image support
- **Push Notifications**: Direct iOS (APNs) and Android (FCM) push notifications
- **File Storage**: AWS S3 integration for timetable files and announcement images

### Key Features

- ✅ **Automated Timetable Parsing**: Rule-based parser extracts classes, teachers, courses from Excel files
- ✅ **Role-Based Access Control**: 5-tier access system (Super, Supreme, Head, Multi, Custodian)
- ✅ **Department Scoping**: Multi-department support with granular access control
- ✅ **Push Notifications**: Direct APNs and FCM integration (no Firebase SDK)
- ✅ **Async Processing**: Bull queues for scalable notification processing
- ✅ **File Management**: AWS S3 storage for timetable files and images
- ✅ **Account Approval Workflow**: Pending account system with approval process
- ✅ **Notification Logging**: Complete audit trail of all notifications

## 🏗️ Technology Stack

- **Framework**: NestJS 10.x
- **Database**: PostgreSQL 16 with TypeORM
- **Queue System**: Bull (Redis-backed) for async jobs
- **Storage**: AWS S3
- **Authentication**: JWT with custom auth service
- **Push Notifications**: Direct APNs (iOS) and FCM HTTP v1 API (Android)
- **File Processing**: Multer, XLSX, PDFKit

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **PostgreSQL** 16.x (or use Docker)
- **Redis** 7.x (or use Docker)
- **Docker** and **Docker Compose** (optional, for local development)

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

The easiest way to get started is using Docker Compose:

```bash
# Clone the repository
git clone <repository-url>
cd unimate-backend

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start all services (PostgreSQL, Redis, API)
docker-compose up -d

# Run database migrations
docker-compose exec api npm run migration:run

# View logs
docker-compose logs -f api
```

The API will be available at `http://localhost:4000/api`

### Option 2: Local Development

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Setup Database

Start PostgreSQL and Redis:

```bash
# Using Docker
docker-compose up -d postgres redis

# Or install locally and start services
# PostgreSQL: brew install postgresql@16 && brew services start postgresql@16
# Redis: brew install redis && brew services start redis
```

#### 3. Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your configuration. See [`.env.example`](./.env.example) for the complete list of environment variables.

**Required variables:**

- `DATABASE_*` - PostgreSQL connection settings
- `REDIS_*` - Redis connection settings
- `JWT_SECRET` - Secret key for JWT tokens (change in production!)

**Optional variables:**

- `AWS_*` - AWS S3 configuration for file storage
- `APNS_*` - Apple Push Notification service configuration
- `FCM_*` - Firebase Cloud Messaging configuration
- `SMTP_*` or `POSTMARK_*` - Email service configuration

#### 4. Run Database Migrations

```bash
npm run migration:run
```

#### 5. Start Development Server

```bash
npm run start:dev
```

The API will be available at `http://localhost:4000/api`

## 📚 Available Scripts

```bash
# Development
npm run start:dev      # Start with hot-reload
npm run start:debug    # Start with debugging
npm run start:prod     # Start production build

# Building
npm run build          # Build for production

# Database
npm run migration:generate  # Generate new migration
npm run migration:create    # Create empty migration
npm run migration:run       # Run pending migrations
npm run migration:revert    # Revert last migration
npm run migration:show      # Show migration status

# Code Quality
npm run lint           # Run ESLint
npm run format         # Format code with Prettier

# Testing
npm test               # Run unit tests
npm run test:watch     # Run tests in watch mode
npm run test:cov       # Run tests with coverage
npm run test:e2e       # Run end-to-end tests
```

## 🗂️ Project Structure

```
unimate-backend/
├── src/
│   ├── common/              # Shared utilities, guards, decorators
│   ├── config/              # Configuration management
│   ├── database/           # Entities, migrations, data source
│   ├── modules/            # Feature modules
│   │   ├── auth/           # Authentication & JWT
│   │   ├── user/           # User management
│   │   ├── department/     # Department management
│   │   ├── timetable/     # Timetable processing
│   │   ├── announcement/   # Announcements
│   │   ├── notification/   # Push notifications
│   │   └── storage/        # AWS S3 storage
│   └── main.ts             # Application entry point
├── test/                   # E2E tests
├── docker-compose.yml      # Docker services configuration
├── Dockerfile              # Production Docker image
└── package.json
```

## 🔐 Authentication & Authorization

### Access Levels

The system uses a 5-tier access control system:

1. **SUPER**: Full system access, can manage all departments
2. **SUPREME**: Multi-department administrator
3. **HEAD**: Single department administrator
4. **MULTI**: Multi-department user (student/teacher)
5. **CUSTODIAN**: Single department user (student/teacher)

### API Authentication

All protected endpoints require a JWT token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

### Example Request

```bash
curl -X GET http://localhost:4000/api/departments \
  -H "Authorization: Bearer <your-jwt-token>"
```

## 📡 API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh access token

### Users

- `GET /api/users/accounts` - List all accounts
- `POST /api/users/accounts` - Create new account
- `PUT /api/users/accounts/:id` - Update account
- `DELETE /api/users/accounts/:id` - Delete account

### Departments

- `GET /api/departments` - List all departments
- `POST /api/departments` - Create department
- `PUT /api/departments/:id` - Update department
- `DELETE /api/departments/:id` - Delete department

### Timetables

- `POST /api/timetables/upload` - Upload timetable file
- `POST /api/timetables/preview` - Preview timetable before upload
- `GET /api/timetables/history` - Get timetable history
- `GET /api/timetables/:id/entries` - Get timetable entries for editor
- `PUT /api/timetables/:id/entries` - Update timetable entries
- `DELETE /api/timetables/:id` - Delete timetable

### Announcements

- `GET /api/announcements` - List announcements
- `POST /api/announcements` - Create announcement
- `PUT /api/announcements/:id` - Update announcement
- `DELETE /api/announcements/:id` - Delete announcement

### Notifications

- `POST /api/notifications/devices` - Register device token
- `POST /api/notifications/send` - Send custom notification

See API documentation for complete endpoint list and request/response formats.

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### E2E Tests

```bash
npm run test:e2e
```

### Test Coverage

```bash
npm run test:cov
```

## 🐳 Docker

### Development

```bash
docker-compose up -d
```

### Production

```bash
docker build -t unimate-backend .
docker run -p 4000:4000 --env-file .env unimate-backend
```

## 📝 Database Migrations

### Create a New Migration

```bash
npm run migration:generate src/database/migrations/YourMigrationName
```

### Run Migrations

```bash
npm run migration:run
```

### Revert Last Migration

```bash
npm run migration:revert
```

## 🔧 Configuration

The application uses NestJS ConfigModule with support for:

- Environment variables (`.env` file)
- Doppler secrets (production)
- Type-safe configuration interfaces

See `src/config/configuration.ts` for available configuration options.

## 🚨 Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check connection
psql -h localhost -U postgres -d unimate_backend
```

### Redis Connection Issues

```bash
# Check Redis is running
docker-compose ps redis

# Test Redis connection
redis-cli ping
```

### Migration Issues

```bash
# Show migration status
npm run migration:show

# If migrations are out of sync, check database
# and manually fix if needed
```

## 📖 Documentation

- [Claude.md](./Claude.md) - Development guide for AI assistants
- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting: `npm run lint && npm test`
4. Commit with descriptive messages
5. Push and create a pull request

## 📄 License

MIT

## 👥 Authors

UniMate Team

---

**Note**: This backend was migrated from Firebase Cloud Functions to NestJS. All Firebase dependencies have been removed and replaced with custom implementations.
