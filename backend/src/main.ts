import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = process.env.PORT ?? 3000;

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  // Graceful shutdown — libera porta antes do PM2 reiniciar
  app.enableShutdownHooks();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
  });

  try {
    await app.listen(port);
    logger.log(`Backend rodando na porta ${port}`);

    // Sinaliza ao PM2 que o app está pronto (usado com wait_ready: true)
    if (typeof process.send === 'function') {
      process.send('ready');
    }
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Porta ${port} já está em uso. Encerrando...`);
      process.exit(1);
    }
    throw err;
  }
}
bootstrap();
