import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { connectDatabase } from './config/db.js';
import { startNudgeScheduler } from './jobs/nudgeJob.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import notificationsRoutes from './routes/notificationsRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import taskRoutes from './routes/taskRoutes.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 5000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:3000';

app.use(
  cors({
    origin: clientOrigin,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'IT Quest API is running.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use((_req, res) => {
  res.status(404).json({ ok: false, message: 'Route not found.' });
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode ?? 500;
  const message = error.message ?? 'Internal server error.';

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({ ok: false, message });
});

async function startServer() {
  await connectDatabase();

  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });

  startNudgeScheduler();
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
