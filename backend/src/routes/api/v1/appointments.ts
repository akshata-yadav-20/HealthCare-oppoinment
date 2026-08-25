import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../../../middleware/auth';
import { isMockMode, getMockStore, getPrisma } from '../../../config/prisma';
import { isSlotAvailable } from '../../../services/availability';
import { addMinutes } from '../../../utils/helpers';
import { generatePreVisit } from '../../../services/llm';
import { enqueueNotification } from '../../../services/notifications';
import { createCalendarEvent, deleteCalendarEvent } from '../../../services/calendar';
import { logger } from '../../../config/logger';
const router = Router();
const holdSchema = z.object({ doctorId: z.string(), slotStart: z.string().datetime(), slotEnd: z.string().datetime().optional() });
router.post('/hold', authenticate, authorize('PATIENT','ADMIN'), async (req: AuthRequest, res, next)=>{
  try {
    const { doctorId, slotStart, slotEnd } = holdSchema.parse(req.body);
    const start = new Date(slotStart);
    let end = slotEnd ? new Date(slotEnd) : null;
    if (!end) {
      let duration = 30;
      if (isMockMode()){
        const store=getMockStore();
        const d=store.doctorProfiles.find(x=>x.id===doctorId);
        duration=d?.slotDurationMinutes||30;
      } else {
        const doc=await getPrisma().doctorProfile.findUnique({ where:{ id:doctorId } });
        duration=(doc as any)?.slotDurationMinutes||30;
      }
      end = addMinutes(start, duration);
    }
    const available = await isSlotAvailable(doctorId, start);
    if (!available) return res.status(409).json({ success:false, error:'Slot not available' });
    let appointment: any;
    const holdExpiresAt = addMinutes(new Date(), 10);
    if (isMockMode()){
      const store=getMockStore();
      const exists = store.appointments.find(a=>a.doctorId===doctorId && new Date(a.slotStart).toISOString()===start.toISOString() && (a.status==='HELD' && (!a.holdExpiresAt || new Date(a.holdExpiresAt)>new Date()) || a.status==='CONFIRMED'));
      if (exists) return res.status(409).json({ success:false, error:'Slot already booked (concurrent)' });
      appointment = { id:'a_'+Date.now()+'_'+Math.random().toString(36).slice(2,5), patientId: req.user!.id, doctorId, slotStart:start, slotEnd:end, status:'HELD', holdExpiresAt, createdAt:new Date(), updatedAt:new Date() };
      store.appointments.push(appointment);
    } else {
      const prisma=getPrisma();
      try {
        appointment = await prisma.$transaction(async (tx:any)=>{
          const existing = await tx.appointment.findFirst({ where:{ doctorId, slotStart:start, status:{ in:['HELD','CONFIRMED'] } } });
          if (existing) {
            if (existing.status==='HELD' && existing.holdExpiresAt && new Date(existing.holdExpiresAt) < new Date()) {
              await tx.appointment.delete({ where:{ id: existing.id } });
            } else {
              throw Object.assign(new Error('Slot already booked'), { status:409 });
            }
          }
          return tx.appointment.create({ data:{ patientId:req.user!.id, doctorId, slotStart:start, slotEnd:end, status:'HELD', holdExpiresAt } });
        });
      } catch(e:any){
        if (e.status===409) return res.status(409).json({ success:false, error:e.message });
        if (e.code==='P2002') return res.status(409).json({ success:false, error:'Slot already booked (unique constraint)' });
        throw e;
      }
    }
    logger.info({ appointmentId: appointment.id, doctorId, slotStart }, 'Hold created');
    res.status(201).json({ success:true, data:appointment });
  } catch(e){ next(e); }
});
const confirmSchema = z.object({ rawSymptoms: z.string().min(5), duration: z.string().optional(), severity: z.string().optional(), existingConditions: z.string().optional() });
router.post('/:id/confirm', authenticate, async (req: AuthRequest, res, next)=>{
  try{
    const { id } = req.params;
    const body = confirmSchema.parse(req.body);
    let appointment: any;
    if (isMockMode()){
      const store=getMockStore();
      appointment=store.appointments.find(a=>a.id===id);
      if (!appointment) return res.status(404).json({success:false,error:'Appointment not found'});
      if (appointment.patientId !== req.user!.id && req.user!.role!=='ADMIN') return res.status(403).json({success:false,error:'Not owner'});
      if (appointment.status !== 'HELD') return res.status(400).json({success:false,error:'Not in HELD status'});
      if (appointment.holdExpiresAt && new Date(appointment.holdExpiresAt) < new Date()) {
        appointment.status='CANCELLED';
        return res.status(410).json({success:false,error:'Hold expired'});
      }
      appointment.status='CONFIRMED';
      appointment.updatedAt=new Date();
      const pre = await generatePreVisit(body.rawSymptoms);
      const sf = { id:'sf_'+Date.now(), appointmentId:id, rawSymptoms:body.rawSymptoms, duration:body.duration, severity:body.severity, existingConditions:body.existingConditions, structured: pre.data, urgencyLevel: (pre.data as any)?.urgencyLevel||'Low', llmStatus: pre.status==='SUCCESS'?'SUCCESS':'FAILED', llmRaw: pre.raw, createdAt:new Date() };
      store.symptomForms.push(sf);
      const doctor = store.doctorProfiles.find(d=>d.id===appointment.doctorId);
      const docUser = store.users.find(u=>u.id===doctor?.userId);
      const patientUser = store.users.find(u=>u.id===appointment.patientId);
      enqueueNotification('BOOKING_CONFIRMATION', patientUser?.email||'patient@test.com', { patientName: patientUser?.name, doctorName: docUser?.name, slotStart: appointment.slotStart, symptoms: body.rawSymptoms }, 'Appointment', appointment.id).catch(()=>{});
      if (docUser?.email) enqueueNotification('BOOKING_CONFIRMATION', docUser.email, { patientName: patientUser?.name, doctorName: docUser.name, slotStart: appointment.slotStart, symptoms: body.rawSymptoms }, 'Appointment', appointment.id).catch(()=>{});
      createCalendarEvent(appointment, patientUser?.email||'', docUser?.email||'').catch(()=>{});
      res.json({ success:true, data:{ appointment, symptomForm: sf } });
    } else {
      const prisma=getPrisma();
      const appt=await prisma.appointment.findUnique({ where:{ id } });
      if (!appt) return res.status(404).json({success:false,error:'Not found'});
      if ((appt as any).patientId !== req.user!.id && req.user!.role!=='ADMIN') return res.status(403).json({success:false,error:'Not owner'});
      if ((appt as any).status !== 'HELD') return res.status(400).json({success:false,error:'Not in HELD'});
      if ((appt as any).holdExpiresAt && new Date((appt as any).holdExpiresAt) < new Date()) return res.status(410).json({success:false,error:'Hold expired'});
      const pre = await generatePreVisit(body.rawSymptoms);
      appointment = await prisma.$transaction(async (tx:any)=>{
        const updated=await tx.appointment.update({ where:{ id }, data:{ status:'CONFIRMED' } });
        await tx.symptomForm.create({ data:{ appointmentId:id, rawSymptoms:body.rawSymptoms, duration:body.duration, severity:body.severity, existingConditions:body.existingConditions, structured: pre.data as any, urgencyLevel:(pre.data as any)?.urgencyLevel||'Low', llmStatus: pre.status as any, llmRaw: pre.raw } });
        return updated;
      });
      res.json({ success:true, data:{ appointment } });
      const doctor = await prisma.doctorProfile.findUnique({ where:{ id:(appointment as any).doctorId }, include:{ user:true } as any });
      const patient = await prisma.user.findUnique({ where:{ id:(appointment as any).patientId } });
      enqueueNotification('BOOKING_CONFIRMATION', (patient as any).email, { patientName:(patient as any).name, doctorName:(doctor as any).user.name, slotStart:(appointment as any).slotStart, symptoms:body.rawSymptoms }, 'Appointment', id).catch(()=>{});
      enqueueNotification('BOOKING_CONFIRMATION', (doctor as any).user.email, { patientName:(patient as any).name, doctorName:(doctor as any).user.name, slotStart:(appointment as any).slotStart, symptoms:body.rawSymptoms }, 'Appointment', id).catch(()=>{});
      createCalendarEvent(appointment, (patient as any).email, (doctor as any).user.email).catch(()=>{});
    }
  }catch(e){next(e);}
});
router.post('/:id/symptoms', authenticate, async (req: AuthRequest, res, next)=>{
  try{
    const { id } = req.params;
    const body = confirmSchema.parse(req.body);
    let appointment: any;
    if (isMockMode()){
      const store=getMockStore();
      appointment=store.appointments.find(a=>a.id===id);
      if (!appointment) return res.status(404).json({success:false,error:'Appointment not found'});
      if (appointment.patientId !== req.user!.id && req.user!.role!=='ADMIN') return res.status(403).json({success:false,error:'Not owner'});
      if (appointment.status !== 'HELD') return res.status(400).json({success:false,error:'Not in HELD status'});
      appointment.status='CONFIRMED';
      const pre = await generatePreVisit(body.rawSymptoms);
      const sf = { id:'sf_'+Date.now(), appointmentId:id, rawSymptoms:body.rawSymptoms, duration:body.duration, severity:body.severity, existingConditions:body.existingConditions, structured: pre.data, urgencyLevel: (pre.data as any)?.urgencyLevel||'Low', llmStatus: pre.status==='SUCCESS'?'SUCCESS':'FAILED', llmRaw: pre.raw, createdAt:new Date() };
      store.symptomForms.push(sf);
      const doctor = store.doctorProfiles.find(d=>d.id===appointment.doctorId);
      const docUser = store.users.find(u=>u.id===doctor?.userId);
      const patientUser = store.users.find(u=>u.id===appointment.patientId);
      enqueueNotification('BOOKING_CONFIRMATION', patientUser?.email||'patient@test.com', { patientName: patientUser?.name, doctorName: docUser?.name, slotStart: appointment.slotStart, symptoms: body.rawSymptoms }, 'Appointment', appointment.id).catch(()=>{});
      createCalendarEvent(appointment, patientUser?.email||'', docUser?.email||'').catch(()=>{});
      res.json({ success:true, data:{ appointment, symptomForm: sf } });
    } else {
      const prisma=getPrisma();
      const appt=await prisma.appointment.findUnique({ where:{ id } });
      if (!appt) return res.status(404).json({success:false,error:'Not found'});
      const pre = await generatePreVisit(body.rawSymptoms);
      appointment = await prisma.$transaction(async (tx:any)=>{
        const updated=await tx.appointment.update({ where:{ id }, data:{ status:'CONFIRMED' } });
        await tx.symptomForm.create({ data:{ appointmentId:id, rawSymptoms:body.rawSymptoms, duration:body.duration, severity:body.severity, existingConditions:body.existingConditions, structured: pre.data as any, urgencyLevel:(pre.data as any)?.urgencyLevel||'Low', llmStatus: pre.status as any, llmRaw: pre.raw } });
        return updated;
      });
      res.json({ success:true, data:{ appointment } });
    }
  }catch(e){next(e);}
});
router.get('/', authenticate, async (req:AuthRequest,res,next)=>{
  try{
    let appts:any[]=[];
    if (isMockMode()){
      const store=getMockStore();
      if (req.user!.role==='PATIENT') appts=store.appointments.filter(a=>a.patientId===req.user!.id);
      else if (req.user!.role==='DOCTOR'){ const doc=store.doctorProfiles.find(d=>d.userId===req.user!.id); appts=doc?store.appointments.filter(a=>a.doctorId===doc.id):[]; }
      else appts=store.appointments;
      appts=appts.map(a=>{ const sf=store.symptomForms.find(s=>s.appointmentId===a.id); const vn=store.visitNotes.find(v=>v.appointmentId===a.id); return {...a, symptomForm:sf, visitNote:vn}; });
    } else {
      const where:any={};
      if (req.user!.role==='PATIENT') where.patientId=req.user!.id;
      if (req.user!.role==='DOCTOR'){ const doc=await getPrisma().doctorProfile.findUnique({ where:{ userId:req.user!.id } }); if (doc) where.doctorId=(doc as any).id; }
      appts=await getPrisma().appointment.findMany({ where, include:{ symptomForm:true, visitNote:true } as any, orderBy:{ slotStart:'desc' } as any });
    }
    res.json({ success:true, data:appts });
  }catch(e){ next(e); }
});
router.get('/:id', authenticate, async (req:AuthRequest,res,next)=>{
  try{
    const { id }=req.params;
    let appt:any=null;
    if (isMockMode()){ const s=getMockStore(); appt=s.appointments.find(a=>a.id===id); if(appt){ const sf=s.symptomForms.find(x=>x.appointmentId===id); const vn=s.visitNotes.find(x=>x.appointmentId===id); appt={...appt, symptomForm:sf, visitNote:vn}; } }
    else { appt=await getPrisma().appointment.findUnique({ where:{ id }, include:{ symptomForm:true, visitNote:true } as any }); }
    if (!appt) return res.status(404).json({ success:false, error:'Not found' });
    res.json({ success:true, data:appt });
  }catch(e){ next(e); }
});
router.post('/:id/cancel', authenticate, async (req:AuthRequest,res,next)=>{
  try{
    const { id }=req.params;
    if (isMockMode()){
      const s=getMockStore(); const a=s.appointments.find(x=>x.id===id); if(!a) return res.status(404).json({success:false,error:'Not found'}); if(a.patientId!==req.user!.id && req.user!.role!=='ADMIN' && req.user!.role!=='DOCTOR') return res.status(403).json({success:false,error:'Not owner'}); a.status='CANCELLED'; deleteCalendarEvent(id).catch(()=>{}); const patient=s.users.find(u=>u.id===a.patientId); if(patient?.email) enqueueNotification('CANCELLATION', patient.email, { slotStart:a.slotStart }, 'Appointment', id).catch(()=>{}); res.json({ success:true, data:a });
    } else {
      const prisma=getPrisma(); const a=await prisma.appointment.findUnique({ where:{ id } }); if(!a) return res.status(404).json({success:false,error:'Not found'}); const updated=await prisma.appointment.update({ where:{ id }, data:{ status:'CANCELLED' } }); deleteCalendarEvent(id).catch(()=>{}); res.json({ success:true, data:updated });
    }
  }catch(e){ next(e); }
});
export default router;
