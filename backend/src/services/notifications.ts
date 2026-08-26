import { logger } from '../config/logger';
import { sendEmail, templatedEmail } from './email';
import { isMockMode, getPrisma, getMockStore } from '../config/prisma';
type QueueItem = { type: string; recipient: string; payload: any; relatedEntity?: string; relatedId?: string; retryCount: number };
const queue: QueueItem[] = [];
export async function enqueueNotification(type: string, recipient: string, payload: any, relatedEntity?: string, relatedId?: string) {
  const item: QueueItem = { type, recipient, payload, relatedEntity, relatedId, retryCount: 0 };
  if (isMockMode()) {
    const store = getMockStore();
    store.notificationLogs.push({ id: 'notif_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), type, recipient, channel: 'EMAIL', status: 'PENDING', retryCount: 0, relatedEntity, relatedId, payload, createdAt: new Date() });
  } else {
    const prisma = getPrisma();
    await prisma.notificationLog.create({ data: { type: type as any, recipient, channel: 'EMAIL', status: 'PENDING', retryCount: 0, relatedEntity, relatedId, payload } as any });
  }
  queue.push(item);
  processQueue().catch(()=>{});
  logger.info({ type, recipient }, 'Notification enqueued');
}
async function processQueue() {
  while (queue.length > 0) {
    const item = queue.shift()!;
    const emailPayload = templatedEmail(item.type, { ...item.payload, to: item.recipient });
    let result: any;
    const { forceFailNext } = await import('./email.js');
    if (forceFailNext) {
      const { setForceFail } = await import('./email.js');
      setForceFail(false);
      result = { success: false, error: 'Forced failure for testing' };
    } else {
      result = await sendEmail(emailPayload);
    }
    if (result.success) {
      updateLog(item, 'SENT', null);
    } else {
      if (item.retryCount < 3) {
        item.retryCount++;
        const backoff = Math.pow(2, item.retryCount) * 1000;
        updateLog(item, 'PENDING', result.error);
        setTimeout(() => { queue.push(item); processQueue(); }, backoff);
        logger.warn({ type: item.type, retry: item.retryCount, backoff }, 'Email retry scheduled');
      } else {
        updateLog(item, 'FAILED', result.error);
      }
    }
  }
}
function updateLog(item: QueueItem, status: string, error: string | null) {
  if (isMockMode()) {
    const store = getMockStore();
    const log = [...store.notificationLogs].reverse().find(l => l.recipient === item.recipient && l.type === item.type);
    if (log) { log.status = status; log.retryCount = item.retryCount; if (error) (log as any).error = error; }
  } else {
    const prisma = getPrisma();
    prisma.notificationLog.findFirst({ where: { recipient: item.recipient, type: item.type as any }, orderBy: { createdAt: 'desc' } } as any).then((log: any)=>{
      if (log) prisma.notificationLog.update({ where: { id: log.id }, data: { status: status as any, retryCount: item.retryCount, error } as any }).catch(()=>{});
    });
  }
}
export async function retryFailedNotifications() {
  if (isMockMode()) {
    const store = getMockStore();
    const failed = store.notificationLogs.filter(l => (l.status==='PENDING' || l.status==='FAILED') && l.retryCount < 3);
    for (const f of failed) {
      if (Math.random() > 0.5) continue;
      const payload = f.payload;
      const res = await sendEmail(templatedEmail(f.type, { ...payload, to: f.recipient }));
      if (res.success) { f.status='SENT'; }
      else { f.retryCount++; if (f.retryCount>=3) f.status='FAILED'; }
    }
  }
}
export function getQueueLength(){ return queue.length; }
