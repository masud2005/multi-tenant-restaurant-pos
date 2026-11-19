import { Reflector } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ValidationException } from './common/exceptions';

export function configureApp(app: INestApplication): void {
  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const validationErrors = errors.map((error) => ({
          field: error.property,
          message: Object.values(error.constraints ?? {})[0] ?? 'Invalid value',
          value: error.value,
        }));
        return new ValidationException(validationErrors);
      },
    }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Backend API')
    .setDescription('The API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: false,
  });
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
