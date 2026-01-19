import { ValidationPipe } from '@nestjs/common';

export const validationPipeConfig = new ValidationPipe({
  whitelist: true, // Strip properties that don't have decorators
  forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
  transform: true, // Transform payloads to DTO instances
  transformOptions: {
    enableImplicitConversion: true, // Convert types automatically
  },
});
