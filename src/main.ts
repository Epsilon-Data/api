import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AuthExceptionFilter } from './auth/auth.filter';

import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.setGlobalPrefix(configService.get<string>('apiBaseUrl'));
  app.enableCors({
    origin: configService.get('auth.trustedWebOrigins'),
    credentials: true,
  });

  app.useGlobalFilters(new AuthExceptionFilter());

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  // start api service
  await app.listen(configService.get('apiPort'));
}
bootstrap();
