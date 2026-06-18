import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ensureUploadDir } from './common/upload/multer.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });
  const config = app.get(ConfigService);

  const apiPrefix = config.get<string>('API_PREFIX') ?? 'api';
  app.setGlobalPrefix(apiPrefix, { exclude: ['health'] });

  // ===== Security =====
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: (config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  });

  // ===== Validation =====
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ===== Global filters & interceptors =====
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // ===== Static uploads =====
  ensureUploadDir();
  app.useStaticAssets(join(process.cwd(), config.get('UPLOAD_DIR') ?? 'uploads'), {
    prefix: `/${config.get('UPLOAD_DIR') ?? 'uploads'}`,
  });

  // ===== Swagger =====
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ArendaHub API')
    .setDescription(
      'Enterprise Property Management SaaS — NestJS + Prisma + PostgreSQL',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('PORT') ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 ArendaHub API: http://localhost:${port}/${apiPrefix}`);
  // eslint-disable-next-line no-console
  console.log(`📚 Swagger: http://localhost:${port}/${apiPrefix}/docs`);
}

void bootstrap();
