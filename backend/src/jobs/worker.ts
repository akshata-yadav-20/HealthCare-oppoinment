import cron from 'node-cron';
import { isMockMode, getMockStore, getPrisma } from '../config/prisma';
import { logger } from '../config/logger';
import { retryFailedNotifications, enqueueNotification } from '../services/notifications';
export function startJobs() {
  cron.schedule('* * * * *', async ()=>{
    try {
      if (isMockMode()){
        const store=getMockStore();
        const now=new Date();
        let cleaned=0;
        for (const a of store.appointments){
          if (a.status==='HELD' && a.holdExpiresAt && new Date(a.holdExpiresAt) < now){
            a.status='CANCELLED';
            cleaned++;
          }
        }
        if (cleaned) logger.info({ cleaned }, 'Expired holds cleaned');
      } else {
        const prisma=getPrisma();
        const res=await prisma.appointment.updateMany({ where:{ status:'HELD', holdExpiresAt:{ lt:new Date() } }, data:{ status:'CANCELLED' } });
        if ((res as any).count) logger.info({ count:(res as any).count }, 'Expired holds cleaned');
      }
    } catch(e:any){ logger.error({ err:e.message }, 'Hold cleanup failed'); }
  });
  cron.schedule('* * * * *', async ()=>{
    try{ await retryFailedNotifications(); } catch(e:any){ logger.error({ err:e.message }, 'Retry failed'); }
  });
  cron.schedule('* * * * *', async ()=>{
    try{
      if (isMockMode()){
        const store=getMockStore();
        const now=new Date();
        const in24h=new Date(now.getTime()+24*3600000);
        const upcoming=store.appointments.filter(a=>a.status==='CONFIRMED' && new Date(a.slotStart) > now && new Date(a.slotStart) <= in24h);
        for (const ap of upcoming){
          const diff = new Date(ap.slotStart).getTime() - now.getTime();
          if (Math.abs(diff - 24*3600000) < 1800000){
            const patient=store.users.find(u=>u.id===ap.patientId);
            if (patient?.email){
              const already=store.notificationLogs.find(n=>n.relatedId===ap.id && n.type==='REMINDER' && n.createdAt.toDateString()===now.toDateString());
              if (!already) {
                await enqueueNotification('REMINDER', patient.email, { slotStart: ap.slotStart, doctorName: 'Doctor' }, 'Appointment', ap.id);
                logger.info({ appointmentId: ap.id }, '24h reminder sent');
              }
            }
          }
        }
        const due = store.medicationReminders.filter(m=> m.status==='PENDING' && new Date(m.nextSendAt) <= now);
        for (const mr of due){
          function parseDurationToMs(dur:string): number {
            if (!dur) return 30*24*3600000;
            const low=dur.toLowerCase();
            const num=parseFloat(low.match(/\d+(\.\d+)?/)?.[0]||'0');
            if (low.includes('week')) return num*7*24*3600000;
            if (low.includes('month')) return num*30*24*3600000;
            return num*24*3600000;
          }
          const maxEnd = new Date(new Date(mr.createdAt).getTime() + parseDurationToMs(mr.duration));
          if (now > maxEnd) { mr.status='CANCELLED'; logger.info({ drug:mr.drug, duration:mr.duration }, 'Medication reminder duration elapsed — cancelled'); continue; }
          const vn=store.visitNotes.find(v=>v.id===mr.visitNoteId);
          const ap=store.appointments.find(a=>a.id===vn?.appointmentId);
          const patient=store.users.find(u=>u.id===ap?.patientId);
          if (patient?.email){
            await enqueueNotification('MEDICATION_REMINDER', patient.email, { drug:mr.drug, dosage:mr.dosage, frequency:mr.frequency, duration:mr.duration }, 'MedicationReminder', mr.id);
            mr.status='SENT'; (mr as any).lastSentAt=new Date();
            let hours=24;
            if (mr.frequency.toLowerCase().includes('twice')||mr.frequency.includes('2')) hours=12;
            else if (mr.frequency.includes('8')) hours=8;
            else if (mr.frequency.includes('6')) hours=6;
            const next = new Date(now.getTime()+hours*3600000);
            if (next > maxEnd) { mr.status='CANCELLED'; logger.info({ drug:mr.drug }, 'Medication reminder reached duration end'); }
            else { mr.nextSendAt=next; mr.status='PENDING'; }
            logger.info({ drug:mr.drug }, 'Medication reminder sent');
          }
        }
      }
    }catch(e:any){ logger.error({ err:e.message }, 'Reminder job failed'); }
  });
  logger.info('CuraVia background jobs started');
}
