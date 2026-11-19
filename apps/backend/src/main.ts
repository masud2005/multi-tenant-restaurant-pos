import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  // Start the server
  const PORT = process.env.PORT ?? 3000;
  await app.listen(PORT, '0.0.0.0');
  console.log(`Server running on PORT ${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}/api/v1`);
  console.log(`API documentation: http://localhost:${PORT}/docs`);
}

bootstrap();
