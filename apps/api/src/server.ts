import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { seedDatabase } from './scripts/seed';
import { dbStore } from './db/store';

const app = express();

app.use(cors({
  origin: '*', // Allow admin web during development
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'SaaS Communication & Shop Management API',
    version: '1.0.0',
  });
});

// API Routes (v1)
app.use('/api/v1', apiRoutes);

// Error handling middleware
app.use(errorHandler);

// Auto-seed store if empty
async function bootstrap() {
  try {
    const adminCount = await dbStore.collection('users').count();
    if (adminCount === 0) {
      console.log('No users found in store. Automatically bootstrapping initial platform seed data...');
      await seedDatabase();
    }
  } catch (err: any) {
    console.warn('Bootstrap note:', err?.message || err);
    try {
      await seedDatabase();
    } catch (_) {}
  }

  app.listen(config.port, () => {
    console.log(`====================================================`);
    console.log(`🚀 SaaS Backend REST API running on port ${config.port}`);
    console.log(`📡 URL: http://localhost:${config.port}/api/v1`);
    console.log(`💓 Health: http://localhost:${config.port}/health`);
    console.log(`====================================================`);
  });
}

bootstrap().catch(err => {
  console.error('Failed to start server:', err);
});

export default app;
