import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middleware/error';
import { getPrisma, testDbConnection, isMockMode } from './config/prisma';
import authRoutes from './routes/api/v1/auth';
import doctorRoutes from './routes/api/v1/doctors';
import appointmentRoutes from './routes/api/v1/appointments';
import visitRoutes from './routes/api/v1/visits';
import leaveRoutes from './routes/api/v1/doctor-leaves';
import adminRoutes from './routes/api/v1/admin';
import calendarRoutes from './routes/api/v1/calendar';
import reviewRoutes from './routes/api/v1/reviews';
import paymentRoutes from './routes/api/v1/payments';
import waitingRoutes from './routes/api/v1/waiting';
import { startJobs } from './jobs/worker';
const app = express();
app.use(cors({ origin: env.FRONTEND_URL, credentials:true }));
app.use(express.json());
app.get('/health', (_req,res)=> res.json({ success:true, data:{ status:'ok', mockMode: isMockMode(), timestamp: new Date().toISOString() } }));
app.get('/api/v1/health', (_req,res)=> res.json({ success:true, data:{ status:'ok', version:'v1' } }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/visits', visitRoutes);
app.use('/api/v1/doctor-leaves', leaveRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/calendar', calendarRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/waiting-list', waitingRoutes);
app.use(errorHandler);
const port = env.PORT;
if (!process.env.VERCEL) {
  app.listen(port, async ()=>{
    logger.info('CuraVia server listening on ' + port + ' mockMode=' + isMockMode());
    if (!isMockMode()) { await testDbConnection(); try { await getPrisma().$connect(); } catch {} }
    startJobs();
    try { const { seedIfNeeded } = await import('./seed'); await seedIfNeeded(); } catch(e:any){ logger.warn({ err:e.message }, 'Seed check failed'); }
  });
} else {
  (async()=>{ if (!isMockMode()) { try { await getPrisma().$connect(); } catch {} } try { const { seedIfNeeded } = await import('./seed'); await seedIfNeeded(); } catch {} })();
}
export default app;
