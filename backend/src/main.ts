import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = process.env.PORT ?? 3000;
  const isProd = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  // Graceful shutdown — libera porta antes do PM2 reiniciar
  app.enableShutdownHooks();

  // Fase 2G — Helmet + HSTS + CSP (hardening HTTP).
  // CSP em reportOnly enquanto valida-se em dev (1-2 dias) — bumpar para
  // enforce após confirmar que frontend não quebra. Origens externas
  // permitidas: Asaas sandbox/prod (gateway), Anthropic API (CoopereAI),
  // Mermaid CDN (diagramas HTML servidos via /docs).
  app.use(
    helmet({
      contentSecurityPolicy: {
        reportOnly: !isProd, // dev: report-only, prod: enforce
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind injection
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: [
            "'self'",
            'https://api.asaas.com',
            'https://api-sandbox.asaas.com',
            'https://api.anthropic.com',
          ],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      hsts: {
        maxAge: 15552000, // 180 dias
        includeSubDomains: true,
        preload: false,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false, // libera embeds de boletos Asaas
    }),
  );

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
