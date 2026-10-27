import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { checkDatabaseConnectivity, closeDriver } from './config/neo4j';
import { sessionMiddleware } from './middleware/session';
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import commentRoutes from './routes/comment.routes';
import userRoutes from './routes/user.routes';
import notificationRoutes from './routes/notification.routes';
import searchRoutes from './routes/search.routes';

const app = express();

if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(sessionMiddleware);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);

/**
 * Health check endpoint exposing application status and Neo4j database connectivity.
 * Returns ONLY status and connectivity indicator — strictly no credentials or internal errors.
 */
app.get('/api/health', async (_req: Request, res: Response) => {
  const isDbConnected = await checkDatabaseConnectivity();

  const responseBody = {
    status: isDbConnected ? 'ok' : 'degraded',
    database: isDbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  };

  res.status(isDbConnected ? 200 : 503).json(responseBody);
});

/**
 * Global 404 handler for undefined API endpoints (returns structured JSON).
 */
app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    error: 'The requested API endpoint was not found.',
  });
});

/**
 * Centralized error handler to catch malformed payloads, payload limit violations, and unhandled errors.
 * Ensures internal database exceptions or stack traces are never leaked in HTTP responses.
 */
app.use((err: any, _req: Request, res: Response, _next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      status: 'error',
      error: 'Malformed JSON payload.',
    });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({
      status: 'error',
      error: 'Request payload exceeded the maximum allowable size (100kb).',
    });
    return;
  }
  console.error('[Global Error Handler]:', err);
  res.status(500).json({
    status: 'error',
    error: 'An internal server error occurred.',
  });
});

// Start listening if not in test environment
let server: ReturnType<typeof app.listen> | null = null;
if (env.NODE_ENV !== 'test') {
  server = app.listen(env.PORT, () => {
    console.log(`[Server] Express server running on port ${env.PORT}`);
  });
}

/**
 * Graceful shutdown handler to clean up server and database connections.
 */
async function handleShutdown(signal: string) {
  console.log(`[Server] Received ${signal}. Initiating graceful shutdown...`);

  if (server) {
    server.close(() => {
      console.log('[Server] HTTP server closed.');
    });
  }

  await closeDriver();
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default app;
