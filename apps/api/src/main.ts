import 'reflect-metadata';
import 'dotenv/config';
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import {
  Module,
  Controller,
  Get,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  Inject,
} from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { z, ZodError } from 'zod';
import { Database } from './database';
import { AuthService, SessionGuard } from './auth';
import { FinanceService } from './finance';
import { DocumentsService } from './documents';
import { NvidiaService } from './nvidia';
import { CopilotService } from './copilot';
import {
  AuthController,
  FinanceController,
  DocumentsController,
  CopilotController,
} from './controllers';
dotenv.config({ path: resolve(__dirname, '../../../.env'), quiet: true });
const env = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(4000),
    APP_BASE_URL: z.url(),
    DATABASE_URL: z.string().min(10),
    MIGRATION_DATABASE_URL: z.string().min(10),
    SESSION_SECRET: z.string().min(32),
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
    SUPABASE_STORAGE_BUCKET: z.string().default('finsight-private'),
    NVIDIA_API_KEY: z.string().optional(),
    NVIDIA_CHAT_MODEL: z.string().optional(),
    NVIDIA_BASE_URL: z.url().default('https://integrate.api.nvidia.com/v1'),
    NVIDIA_EMBEDDING_MODEL: z.string().default('nvidia/nv-embedqa-e5-v5'),
    NVIDIA_EMBEDDING_DIMENSIONS: z.coerce
      .number()
      .refine((v) => v === 1024)
      .default(1024),
    DEMO_MODE: z.enum(['true', 'false']).default('false'),
  })
  .parse(process.env);
Object.assign(process.env, Object.fromEntries(Object.entries(env).map(([k, v]) => [k, String(v)])));
if (
  env.NODE_ENV === 'production' &&
  !env.APP_BASE_URL.startsWith('https://') &&
  env.DEMO_MODE !== 'true'
)
  throw Error('Real financial deployments require HTTPS.');
if (env.NODE_ENV === 'production' && !env.DATABASE_URL.includes('sslmode=require'))
  throw Error('Production database connections must require SSL.');
@Catch()
class SafeExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (error instanceof ZodError)
      return res
        .status(400)
        .json({ message: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    if (error instanceof HttpException)
      return res.status(error.getStatus()).json({ message: error.message });
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'request_failed',
        type: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
    return res.status(500).json({ message: 'The request could not be completed.' });
  }
}
@Controller('api/health')
class HealthController {
  constructor(@Inject(Database) private db: Database) {}
  @Get() async health() {
    await this.db.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      database: 'connected',
      nvidia:
        process.env.NVIDIA_API_KEY && process.env.NVIDIA_CHAT_MODEL
          ? 'configured (not connectivity-tested)'
          : 'not configured',
    };
  }
}
@Module({
  providers: [
    Database,
    AuthService,
    SessionGuard,
    FinanceService,
    DocumentsService,
    NvidiaService,
    CopilotService,
  ],
  controllers: [
    AuthController,
    FinanceController,
    DocumentsController,
    CopilotController,
    HealthController,
  ],
})
class AppModule {}
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.enableShutdownHooks();
  app.use(helmet());
  app.use(cookieParser());
  app.use(
    rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: 15 * 60000,
      limit: 10,
      skipSuccessfulRequests: true,
      legacyHeaders: false,
    }),
  );
  app.use('/api/copilot', rateLimit({ windowMs: 60000, limit: 15, legacyHeaders: false }));
  app.use((req: any, res: any, next: any) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      const site = req.headers['sec-fetch-site'];
      if ((origin && origin !== new URL(env.APP_BASE_URL).origin) || site === 'cross-site')
        return res.status(403).json({ message: 'Cross-origin changes are not allowed.' });
      if (!origin && env.NODE_ENV === 'production' && site !== 'same-origin')
        return res.status(403).json({ message: 'An origin header is required for changes.' });
    }
    next();
  });
  app.useGlobalFilters(new SafeExceptionFilter());
  const config = new DocumentBuilder()
    .setTitle('FinSight AI')
    .setDescription('Organization-scoped financial intelligence API')
    .setVersion('1.0')
    .addCookieAuth('finsight_session')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(env.PORT, '0.0.0.0');
}
bootstrap().catch(() => {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'startup_failed',
      message: 'Verify database connectivity and required environment variables.',
    }),
  );
  process.exit(1);
});
