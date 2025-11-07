import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AuthExceptionFilter } from './common/filters/auth.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { ConfigService } from '@nestjs/config';
import { PrismaClientExceptionFilter } from './prisma/prisma-client-exception/prisma-client-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.setGlobalPrefix(configService.get<string>('apiBaseUrl')!);
  app.enableCors({
    origin: configService.get<string[]>('auth.trustedWebOrigins'),
    credentials: true,
  });

  app.useGlobalFilters(new AuthExceptionFilter());

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('Epsilon API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(
    `${configService.get<string>('apiBaseUrl')}/docs`,
    app,
    document,
  );

  // add prisma client exception filter
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));

  // start api service
  await app.listen(configService.get<number>('apiPort')!);
}
void bootstrap();
