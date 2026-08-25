import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../../../middleware/auth';
import { isMockMode, getMockStore, getPrisma } from '../../../config/prisma';
import { z } from 'zod';
const router = Router();
router.use(authenticate, authorize('ADMIN'));
router.get('/stats', async (req,res,next)=>{
  try{
    if (isMockMode()){
      const s=getMockStore();
      res.json({ success:true, data:{ users:s.users.length, doctors:s.doctorProfiles.length, appointments:s.appointments.length, pendingNotifications:s.notificationLogs.filter(n=>n.status==='PENDING').length, failedNotifications:s.notificationLogs.filter(n=>n.status==='FAILED').length, auditLogs:s.auditLogs.length } });
    } else {
      const prisma=getPrisma();
      const [users, doctors, appointments, pending, failed] = await Promise.all([
        prisma.user.count(), prisma.doctorProfile.count(), prisma.appointment.count(), prisma.notificationLog.count({ where:{ status:'PENDING' } as any }), prisma.notificationLog.count({ where:{ status:'FAILED' } as any })
      ]);
      res.json({ success:true, data:{ users, doctors, appointments, pendingNotifications:pending, failedNotifications:failed } });
    }
  }catch(e){ next(e); }
});
router.get('/appointments', async (req,res,next)=>{
  try{
    if (isMockMode()){
      const s=getMockStore();
      res.json({ success:true, data:s.appointments });
    } else {
      const appts=await getPrisma().appointment.findMany({ orderBy:{ slotStart:'desc' } as any });
      res.json({ success:true, data:appts });
    }
  }catch(e){ next(e); }
});
router.get('/notifications', async (req,res,next)=>{
  try{
    if (isMockMode()){ res.json({ success:true, data:getMockStore().notificationLogs }); }
    else { res.json({ success:true, data:await getPrisma().notificationLog.findMany({ orderBy:{ createdAt:'desc' } as any }) }); }
  }catch(e){ next(e); }
});
router.get('/audit', async (req,res,next)=>{
  try{
    if (isMockMode()){ res.json({ success:true, data:getMockStore().auditLogs }); }
    else { res.json({ success:true, data:await getPrisma().auditLog.findMany({ orderBy:{ createdAt:'desc' } as any }) }); }
  }catch(e){ next(e); }
});
const doctorCreateSchema = z.object({ email:z.string().email(), password:z.string().min(6), name:z.string(), specialisation:z.string(), slotDurationMinutes:z.number().min(10).max(60).optional(), consultationFee:z.number().optional(), bio:z.string().optional(), workingHours:z.any().optional() });
router.post('/doctors', async (req:AuthRequest,res,next)=>{
  try{
    const body=doctorCreateSchema.parse(req.body);
    if (isMockMode()){
      const s=getMockStore();
      if (s.users.find(u=>u.email===body.email)) return res.status(409).json({ success:false, error:'Email exists' });
      const bcrypt=await import('bcryptjs'); const hash=await bcrypt.hash(body.password,10);
      const u={ id:'u_'+Date.now(), email:body.email, password:hash, name:body.name, role:'DOCTOR', createdAt:new Date() };
      s.users.push(u);
      const wh=body.workingHours || { monday:{start:'09:00',end:'17:00',enabled:true}, tuesday:{start:'09:00',end:'17:00',enabled:true}, wednesday:{start:'09:00',end:'17:00',enabled:true}, thursday:{start:'09:00',end:'17:00',enabled:true}, friday:{start:'09:00',end:'17:00',enabled:true}, saturday:{start:'09:00',end:'13:00',enabled:true}, sunday:{start:'09:00',end:'13:00',enabled:false} };
      const doc={ id:'d_'+Date.now(), userId:u.id, specialisation:body.specialisation, workingHours:wh, slotDurationMinutes:body.slotDurationMinutes||30, consultationFee:body.consultationFee||300, bio:body.bio||'', createdAt:new Date() };
      s.doctorProfiles.push(doc);
      res.status(201).json({ success:true, data:doc });
    } else {
      const bcrypt=await import('bcryptjs'); const hash=await bcrypt.hash(body.password,10);
      const prisma=getPrisma();
      const u=await prisma.user.create({ data:{ email:body.email, password:hash, name:body.name, role:'DOCTOR' as any } });
      const doc=await prisma.doctorProfile.create({ data:{ userId:u.id, specialisation:body.specialisation, workingHours:body.workingHours||{}, slotDurationMinutes:body.slotDurationMinutes||30, consultationFee:body.consultationFee||300, bio:body.bio } as any });
      res.status(201).json({ success:true, data:doc });
    }
  }catch(e){ next(e); }
});
export default router;
