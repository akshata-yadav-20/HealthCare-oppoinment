import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
let prisma: PrismaClient | null = null;
export function isMockMode(): boolean {
  return process.env.USE_MOCK_DB === 'true' || !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('user:password');
}
type MockStore = {
  users: any[]; doctorProfiles: any[]; doctorLeaves: any[]; appointments: any[]; symptomForms: any[]; visitNotes: any[];
  medicationReminders: any[]; notificationLogs: any[]; calendarEvents: any[]; auditLogs: any[];
};
const mockStore: MockStore = {
  users: [], doctorProfiles: [], doctorLeaves: [], appointments: [], symptomForms: [], visitNotes: [],
  medicationReminders: [], notificationLogs: [], calendarEvents: [], auditLogs: []
};
export function getMockStore(): MockStore { return mockStore; }
export function getPrisma(): PrismaClient {
  if (isMockMode()) throw new Error('Prisma not available in mock mode');
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}
export async function testDbConnection(): Promise<boolean> {
  if (isMockMode()) { logger.info('Mock mode — no DB connection'); return true; }
  try { await getPrisma().$connect(); logger.info('DB connected'); return true; } catch(e:any){ logger.error({ err:e.message }, 'DB connect failed'); return false; }
}
