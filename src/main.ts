import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AuthExceptionFilter } from './common/filters/auth-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { ConfigService } from '@nestjs/config';
import { PrismaClientExceptionFilter } from './common/filters/prisma-client-exception.filter';
import { AtlasExceptionFilter } from './common/filters/atlas-exception.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.setGlobalPrefix(configService.get<string>('apiBaseUrl')!);
  app.enableCors({
    origin: configService.get<string[]>('auth.trustedWebOrigins'),
    credentials: true,
  });

  app.useGlobalFilters(
    new AuthExceptionFilter(),
    new AtlasExceptionFilter(),
    new PrismaClientExceptionFilter(),
    new HttpExceptionFilter(),
  );

  // controller validations
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // TODO: should we not allow?
      transform: true,
      disableErrorMessages: false,
      exceptionFactory: (errors) => {
        return new BadRequestException(errors);
      },
    }),
  );

  if (configService.get<boolean>('isDev')) {
    const documentConfig = new DocumentBuilder()
      .setTitle('Epsilon API')
      .setDescription('API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, documentConfig);
    SwaggerModule.setup(
      `${configService.get<string>('apiBaseUrl')}/docs`,
      app,
      document,
    );
  }

  // start api service
  await app.listen(configService.get<number>('apiPort')!);
}
void bootstrap();
