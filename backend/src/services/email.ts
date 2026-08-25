import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';
let transporter:any = null;
let forceFailNext = false;
export function setForceFail(v:boolean){ forceFailNext = v; }
export function getForceFail(){ return forceFailNext; }
export async function getTransporter(){
  if (transporter) return transporter;
  if (!env.SMTP_HOST){
    transporter = nodemailer.createTransport({ jsonTransport: true });
    logger.info('Email jsonTransport (stub)');
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}
export function templatedEmail(type:string, payload:any){
  const to = payload.to || 'test@curavia.health';
  let subject = 'CuraVia - ' + type;
  let html = '<h2>CuraVia Health</h2><p>Type: ' + type + '</p><pre>' + JSON.stringify(payload,null,2) + '</pre>';
  if (type==='BOOKING_CONFIRMATION'){ subject='Appointment confirmed - ' + payload.slotStart; html='<h2>Appointment Confirmed</h2><p>Dr. ' + payload.doctorName + ' - ' + new Date(payload.slotStart).toLocaleString() + '</p><p>Patient: ' + payload.patientName + '</p>'; }
  if (type==='LEAVE_CANCELLATION'){ subject='Appointment cancelled - please reschedule'; html='<h2>Appointment Cancelled</h2><p>Your appointment with ' + payload.doctorName + ' on ' + new Date(payload.slotStart).toLocaleString() + ' was cancelled due to doctor leave.</p><a href="' + (process.env.FRONTEND_URL||'http://localhost:5174') + '">Reschedule</a>'; }
  if (type==='REMINDER'){ subject='Reminder - appointment in 24h'; html='<h2>Reminder</h2><p>Your appointment is in 24 hours: ' + new Date(payload.slotStart).toLocaleString() + '</p>'; }
  if (type==='MEDICATION_REMINDER'){ subject='Medication reminder - ' + payload.drug; html='<h2>Medication Reminder</h2><p>Take ' + payload.drug + ' ' + payload.dosage + ' - ' + payload.frequency + ' for ' + payload.duration + '</p>'; }
  return { from: env.SMTP_FROM, to, subject, html };
}
export async function sendEmail(opts:any): Promise<{ success:boolean; error?:string }>{
  if (forceFailNext){ forceFailNext=false; return { success:false, error:'Forced failure for testing' }; }
  try {
    const t = await getTransporter();
    const info = await t.sendMail(opts);
    logger.info({ to:opts.to, messageId:(info as any).messageId }, 'Email sent');
    return { success:true };
  } catch(e:any){
    logger.error({ err:e.message, to:opts.to }, 'Email failed');
    return { success:false, error:e.message };
  }
}
export { forceFailNext };
