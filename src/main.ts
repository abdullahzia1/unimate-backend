import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import * as bodyParser from 'body-parser';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { validationPipeConfig } from './common/pipes/validation.pipe';
import { loadDopplerSecretsIfNeeded } from './config/doppler-loader';

async function bootstrap() {
  // In production on ECS, pull secrets from Doppler before bootstrapping Nest.
  await loadDopplerSecretsIfNeeded();

  // Disable Nest default body parser; we’ll handle Stripe raw + JSON manually.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Use default WebSocket adapter (100MB max payload, no compression issues)

  app.useWebSocketAdapter(new WsAdapter(app));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 4000;

  const corsOriginString =
    configService.get<string>('security.corsOrigin') || 'http://localhost:3000';

  // Split comma-separated origins and trim whitespace
  const corsOrigins = corsOriginString
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  // Use Helmet for security headers
  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Enable CORS
  // In main.ts or app configuration
  app.enableCors({
    origin: [
      'http://localhost:3000', // Development
      'http://localhost:5173', // Vite dev server
      /^file:\/\//, // Electron file protocol
      /^oneorbshield:\/\//, // Your custom protocol
    ],
    credentials: true,
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  // JSON parser for all other routes
  app.use((req: Request, res: Response, next: NextFunction): void => {
    bodyParser.json()(req, res, next);
  });

  // Global pipes
  app.useGlobalPipes(validationPipeConfig);

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  await app.listen(port);

  console.log(`
  [NEST] Application is running on: http://localhost:${port}/api
  [NEST] Environment: ${configService.get('nodeEnv')}
  [NEST] CORS enabled for: ${corsOrigins.join(', ')}
`);
}

void bootstrap();
