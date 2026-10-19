import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

try {
  process.loadEnvFile?.();
} catch {
  // .env file is optional when environment variables are already provided
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend requests (origin: true allows credentials: true with cookies and Authorization header)
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,Accept,Range,X-Requested-With',
    exposedHeaders: 'Content-Range,Content-Disposition,Content-Length',
    credentials: true,
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}`);
}
bootstrap();
