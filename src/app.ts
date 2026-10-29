import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import { authRouter } from './auth/auth.route';
import { usersRouter } from './users/users.route';
import { chatRouter } from './chat/chat.route';
import { errorMiddleware, loggerMiddleware, notFoundMiddleware } from './common/middleware';

// Safely serialize BigInt to string in JSON responses
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

export const createApp = (): Application => {
  const app = express();

  // Core Middlewares
  app.use(cors({ origin: true, credentials: true }));
  app.use(loggerMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Root endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      message: 'Void Effects API is running',
      docs: '/health',
    });
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: +process.uptime().toPrecision(2),
      timestamp: new Date().toISOString(),
    });
  });

  // Feature Routes
  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/chat', chatRouter);

  // 404 Not Found Middleware (catches unhandled routes)
  app.use(notFoundMiddleware);

  // Global Error Handling Middleware (catches thrown errors / next(err))
  app.use(errorMiddleware);

  return app;
};

export const app = createApp();
export default app;
