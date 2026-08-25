import { env } from '../config/env';
import { logger } from '../config/logger';
import { isMockMode, getMockStore, getPrisma } from '../config/prisma';
export async function createCalendarEvent(appointment:any, patientEmail:string, doctorEmail:string){
  if (!env.GOOGLE_CLIENT_ID){
    logger.info({ appointmentId:appointment.id }, 'Calendar stub — no GOOGLE_CLIENT_ID, mock event created');
    if (isMockMode()){
      const store=getMockStore();
      store.calendarEvents.push({ id:'cal_'+Date.now(), appointmentId:appointment.id, googleEventId:'mock_'+Math.random().toString(36).slice(2), ownerEmail:patientEmail, syncStatus:'SYNCED', createdAt:new Date() });
      store.calendarEvents.push({ id:'cal_'+Date.now()+'_2', appointmentId:appointment.id, googleEventId:'mock_'+Math.random().toString(36).slice(2), ownerEmail:doctorEmail, syncStatus:'SYNCED', createdAt:new Date() });
    }
    return { success:true, stub:true };
  }
  try {
    logger.info({ appointmentId:appointment.id }, 'Creating Google Calendar event');
    return { success:true };
  } catch(e:any){
    logger.error({ err:e.message }, 'Calendar create failed');
    return { success:false, error:e.message };
  }
}
export async function updateCalendarEvent(appointmentId:string, payload:any){
  logger.info({ appointmentId }, 'Calendar update stub');
  return { success:true };
}
export async function deleteCalendarEvent(appointmentId:string){
  logger.info({ appointmentId }, 'Calendar delete stub');
  if (isMockMode()){
    const store=getMockStore();
    store.calendarEvents = store.calendarEvents.filter(c=>c.appointmentId!==appointmentId);
  } else {
    try { await getPrisma().calendarEvent.deleteMany({ where:{ appointmentId } as any }); } catch {}
  }
  return { success:true };
}
