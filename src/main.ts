import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
// import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

import { AuthExceptionFilter } from './auth/auth.filter';

import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // const corsOptions: CorsOptions = {
  //   origin: 'http://localhost:3000', // Replace with frontend URL
  //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  //   credentials: true,
  // };
  // app.enableCors(corsOptions);

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
