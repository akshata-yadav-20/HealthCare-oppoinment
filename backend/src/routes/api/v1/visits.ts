import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../../../middleware/auth';
import { isMockMode, getMockStore, getPrisma } from '../../../config/prisma';
import { generatePostVisit } from '../../../services/llm';
import { enqueueNotification } from '../../../services/notifications';
import { logger } from '../../../config/logger';
const router = Router();
const visitSchema = z.object({ clinicalNotes: z.string().min(5), prescription: z.array(z.object({ drug: z.string(), dosage: z.string(), frequency: z.string(), duration: z.string() })).optional().default([]) });
router.post('/:appointmentId', authenticate, authorize('DOCTOR','ADMIN'), async (req: AuthRequest, res, next)=>{
  try{
    const { appointmentId } = req.params;
    const { clinicalNotes, prescription } = visitSchema.parse(req.body);
    let appointment: any;
    if (isMockMode()){
      const store=getMockStore();
      appointment=store.appointments.find(a=>a.id===appointmentId);
      if (!appointment) return res.status(404).json({success:false,error:'Appointment not found'});
      if (req.user!.role==='DOCTOR'){ const doc=store.doctorProfiles.find(d=>d.userId===req.user!.id); if (!doc || doc.id!==appointment.doctorId) return res.status(403).json({success:false,error:'Not your appointment'}); }
      if (appointment.status!=='CONFIRMED' && appointment.status!=='COMPLETED') return res.status(400).json({success:false,error:'Appointment not confirmed'});
      const post = await generatePostVisit(clinicalNotes, prescription);
      const visitNote = { id:'vn_'+Date.now(), appointmentId, clinicalNotes, prescription, patientSummary: (post.data as any)?.summary || post.raw, patientSummaryJson: post.data, llmStatus: post.status==='SUCCESS'?'SUCCESS':'FAILED', createdAt:new Date() };
      store.visitNotes.push(visitNote);
      for (const med of prescription||[]){ const nextSend = new Date(); nextSend.setMinutes(nextSend.getMinutes()+5); store.medicationReminders.push({ id:'mr_'+Date.now()+'_'+Math.random().toString(36).slice(2,4), visitNoteId: visitNote.id, drug: med.drug, dosage: med.dosage, frequency: med.frequency, duration: med.duration, nextSendAt: nextSend, status:'PENDING', createdAt:new Date() }); }
      appointment.status='COMPLETED';
      const patient=store.users.find(u=>u.id===appointment.patientId);
      if (patient?.email) enqueueNotification('BOOKING_CONFIRMATION', patient.email, { slotStart: appointment.slotStart, summary: visitNote.patientSummary }, 'VisitNote', visitNote.id).catch(()=>{});
      logger.info({ appointmentId }, 'Visit note created');
      res.status(201).json({ success:true, data: visitNote });
    } else {
      const prisma=getPrisma();
      appointment=await prisma.appointment.findUnique({ where:{ id:appointmentId } });
      if (!appointment) return res.status(404).json({success:false,error:'Not found'});
      const post = await generatePostVisit(clinicalNotes, prescription);
      const visitNote: any = await prisma.visitNote.create({ data:{ appointmentId, clinicalNotes, prescription: prescription as any, patientSummary:(post.data as any)?.summary||post.raw, patientSummaryJson: post.data as any, llmStatus: post.status as any } });
      for (const med of prescription||[]){ const nextSend=new Date(); nextSend.setMinutes(nextSend.getMinutes()+5); await prisma.medicationReminder.create({ data:{ visitNoteId: visitNote.id, drug:med.drug, dosage:med.dosage, frequency:med.frequency, duration:med.duration, nextSendAt: nextSend, status:'PENDING' } as any }); }
      await prisma.appointment.update({ where:{ id:appointmentId }, data:{ status:'COMPLETED' } });
      res.status(201).json({ success:true, data: visitNote });
    }
  }catch(e){next(e);}
});
router.get('/:appointmentId', authenticate, async (req:AuthRequest,res,next)=>{
  try{
    const { appointmentId }=req.params;
    let note:any;
    if (isMockMode()){ note=getMockStore().visitNotes.find(v=>v.appointmentId===appointmentId); }
    else { note=await getPrisma().visitNote.findUnique({ where:{ appointmentId } }); }
    if (!note) return res.status(404).json({success:false,error:'Not found'});
    res.json({success:true,data:note});
  }catch(e){next(e);}
});
export default router;
