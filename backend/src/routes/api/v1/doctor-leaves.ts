import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../../../middleware/auth';
import { isMockMode, getMockStore, getPrisma } from '../../../config/prisma';
import { enqueueNotification } from '../../../services/notifications';
import { deleteCalendarEvent } from '../../../services/calendar';
import { logger } from '../../../config/logger';
const router = Router();
const leaveSchema = z.object({ doctorId: z.string().optional(), startDate: z.string(), endDate: z.string().optional(), reason: z.string().optional() });
router.post('/', authenticate, authorize('ADMIN','DOCTOR'), async (req:AuthRequest,res,next)=>{
  try{
    const body=leaveSchema.parse(req.body);
    let doctorId = body.doctorId;
    if (req.user!.role==='DOCTOR'){
      if (isMockMode()){ const doc=getMockStore().doctorProfiles.find(d=>d.userId===req.user!.id); doctorId=doc?.id; }
      else { const doc=await getPrisma().doctorProfile.findUnique({ where:{ userId:req.user!.id } }); doctorId=(doc as any)?.id; }
      if (!doctorId) return res.status(404).json({success:false,error:'Doctor profile not found'});
    }
    if (!doctorId) return res.status(400).json({success:false,error:'doctorId required'});
    const start = new Date(body.startDate);
    const end = body.endDate ? new Date(body.endDate) : new Date(body.startDate);
    let leave:any;
    if (isMockMode()){
      const store=getMockStore();
      leave={ id:'lv_'+Date.now(), doctorId, startDate:start, endDate:end, reason:body.reason, createdBy:req.user!.id, createdAt:new Date() };
      store.doctorLeaves.push(leave);
      const affected=store.appointments.filter(a=>a.doctorId===doctorId && (a.status==='CONFIRMED' || a.status==='HELD') && new Date(a.slotStart) >= new Date(start.toISOString().slice(0,10)+'T00:00:00') && new Date(a.slotStart) <= new Date(end.toISOString().slice(0,10)+'T23:59:59'));
      for (const ap of affected){
        ap.status='CANCELLED';
        const patient=store.users.find(u=>u.id===ap.patientId);
        const doctor=store.doctorProfiles.find(d=>d.id===doctorId);
        const docUser=store.users.find(u=>u.id===doctor?.userId);
        if (patient?.email) enqueueNotification('LEAVE_CANCELLATION', patient.email, { doctorName: docUser?.name, slotStart: ap.slotStart }, 'Appointment', ap.id).catch(()=>{});
        deleteCalendarEvent(ap.id).catch(()=>{});
        store.auditLogs.push({ id:'audit_'+Date.now()+'_'+Math.random().toString(36).slice(2,4), action:'LEAVE_CANCELLATION', actorId:req.user!.id, targetType:'Appointment', targetId:ap.id, details:{ leaveId:leave.id, doctorId, slotStart: ap.slotStart }, createdAt:new Date() });
      }
      store.auditLogs.push({ id:'audit_'+Date.now(), action:'CREATE_LEAVE', actorId:req.user!.id, targetType:'DoctorLeave', targetId:leave.id, details:{ doctorId, startDate:start, endDate:end }, createdAt:new Date() });
      logger.info({ leaveId:leave.id, affected: affected.length }, 'Leave created with cancellations');
      res.status(201).json({ success:true, data:{ leave, cancelledCount: affected.length } });
    } else {
      const prisma=getPrisma();
      leave=await prisma.doctorLeave.create({ data:{ doctorId, startDate:start, endDate:end, reason:body.reason, createdBy:req.user!.id } as any });
      const affected=await prisma.appointment.findMany({ where:{ doctorId, status:{ in:['CONFIRMED','HELD'] }, slotStart:{ gte: new Date(start.toISOString().slice(0,10)+'T00:00:00'), lte: new Date(end.toISOString().slice(0,10)+'T23:59:59') } } as any });
      for (const ap of affected){
        await prisma.appointment.update({ where:{ id:(ap as any).id }, data:{ status:'CANCELLED' } });
        await prisma.auditLog.create({ data:{ action:'LEAVE_CANCELLATION', actorId:req.user!.id, targetType:'Appointment', targetId:(ap as any).id, details:{ leaveId:leave.id } as any } });
        deleteCalendarEvent((ap as any).id).catch(()=>{});
      }
      await prisma.auditLog.create({ data:{ action:'CREATE_LEAVE', actorId:req.user!.id, targetType:'DoctorLeave', targetId:(leave as any).id, details:{ doctorId } as any } });
      res.status(201).json({ success:true, data:{ leave, cancelledCount: affected.length } });
    }
  }catch(e){next(e);}
});
router.get('/', authenticate, async (req:AuthRequest,res,next)=>{
  try{
    let leaves:any[]=[];
    if (isMockMode()){
      const store=getMockStore();
      if (req.user!.role==='DOCTOR'){ const doc=store.doctorProfiles.find(d=>d.userId===req.user!.id); leaves=doc? store.doctorLeaves.filter(l=>l.doctorId===doc.id):[]; }
      else { leaves=store.doctorLeaves; }
      leaves=leaves.map(l=>{ const doc=store.doctorProfiles.find(d=>d.id===l.doctorId); const u=store.users.find(u=>u.id===doc?.userId); return { ...l, doctor:doc, doctorUser:u }; });
    } else {
      leaves=await getPrisma().doctorLeave.findMany({ orderBy:{ startDate:'desc' } as any });
    }
    res.json({success:true,data:leaves});
  }catch(e){next(e);}
});
router.delete('/:id', authenticate, authorize('ADMIN','DOCTOR'), async (req,res,next)=>{
  try{
    const { id }=req.params;
    if (isMockMode()){ const store=getMockStore(); const idx=store.doctorLeaves.findIndex(l=>l.id===id); if(idx<0) return res.status(404).json({success:false,error:'Not found'}); store.doctorLeaves.splice(idx,1); }
    else { await getPrisma().doctorLeave.delete({ where:{ id } }); }
    res.json({success:true,data:{}});
  }catch(e){next(e);}
});
export default router;
