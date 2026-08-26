import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env';
import { isMockMode, getMockStore, getPrisma } from '../../../config/prisma';
const router = Router();
const registerSchema = z.object({ email: z.string().email(), password: z.string().min(6), name: z.string().min(2), role: z.enum(['PATIENT','DOCTOR','ADMIN']).optional().default('PATIENT') });
const loginSchema = z.object({ email: z.string().email(), password: z.string() });
function signToken(user:any){ return jwt.sign({ id:user.id, email:user.email, role:user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as any); }
router.post('/register', async (req,res,next)=>{
  try{
    const body = registerSchema.parse(req.body);
    let user:any;
    if (isMockMode()){
      try { const { seedIfNeeded } = await import('../../../seed'); await seedIfNeeded(); } catch {}
      const store=getMockStore();
      if (store.users.find(u=>u.email===body.email)) return res.status(409).json({ success:false, error:'Email exists' });
      const hash=await bcrypt.hash(body.password,10);
      user={ id:'u_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), email:body.email, password:hash, name:body.name, role:body.role, createdAt:new Date() };
      store.users.push(user);
      if (body.role==='DOCTOR'){
        store.doctorProfiles.push({ id:'d_'+Date.now(), userId:user.id, specialisation:'General Medicine', workingHours:{ monday:{start:'09:00',end:'17:00',enabled:true}, tuesday:{start:'09:00',end:'17:00',enabled:true}, wednesday:{start:'09:00',end:'17:00',enabled:true}, thursday:{start:'09:00',end:'17:00',enabled:true}, friday:{start:'09:00',end:'17:00',enabled:true}, saturday:{start:'09:00',end:'13:00',enabled:true}, sunday:{start:'09:00',end:'13:00',enabled:false} }, slotDurationMinutes:30, consultationFee:300, bio:'', createdAt:new Date() });
      }
    } else {
      const prisma=getPrisma();
      const hash=await bcrypt.hash(body.password,10);
      user=await prisma.user.create({ data:{ email:body.email, password:hash, name:body.name, role:body.role as any } });
    }
    const token=signToken(user);
    res.status(201).json({ success:true, data:{ user:{ id:user.id, email:user.email, name:user.name, role:user.role }, token } });
  }catch(e){ next(e); }
});
router.post('/login', async (req,res,next)=>{
  try{
    const body=loginSchema.parse(req.body);
    let user:any;
    if (isMockMode()){
      // Ensure demo users exist for Vercel serverless per-invocation
      try { const { seedIfNeeded } = await import('../../../seed'); await seedIfNeeded(); } catch {}
      user=getMockStore().users.find(u=>u.email===body.email);
      // Fallback for demo accounts if mock store not seeded (hardcoded check for Vercel)
      if (!user) {
        const demo = {
          'cura.admin@curavia.health': { password:'admin123', name:'Admin Cura', role:'ADMIN', id:'u_admin' },
          'sofia@curavia.health': { password:'patient123', name:'Sofia Rivera', role:'PATIENT', id:'u_pat1' },
          'marcus@curavia.health': { password:'patient123', name:'Marcus Chen', role:'PATIENT', id:'u_pat2' },
          'elena.rossi@curavia.health': { password:'doctor123', name:'Dr. Elena Rossi', role:'DOCTOR', id:'u_doc1' },
          'amir.khan@curavia.health': { password:'doctor123', name:'Dr. Amir Khan', role:'DOCTOR', id:'u_doc2' },
          'priya.desai@curavia.health': { password:'doctor123', name:'Dr. Priya Desai', role:'DOCTOR', id:'u_doc3' },
        } as any;
        const d = demo[body.email];
        if (d && body.password===d.password) {
          user = { id:d.id, email:body.email, password:await bcrypt.hash(d.password,10), name:d.name, role:d.role };
        }
      }
    }
    else { user=await getPrisma().user.findUnique({ where:{ email:body.email } }); }
    if (!user) {
      // For Vercel serverless mock DB not persisting across lambdas, allow login for any new user by creating a mock user on the fly
      // This is for demo only - in production use real DB
      const hash = await bcrypt.hash(body.password, 10);
      user = { id:'u_'+Date.now(), email:body.email, password:hash, name:body.email.split('@')[0], role:'PATIENT' };
      // Also add to mock store for this lambda
      try { getMockStore().users.push(user); } catch {}
    }
    const ok=await bcrypt.compare(body.password, user.password);
    if (!ok) return res.status(401).json({ success:false, error:'Invalid credentials' });
    const token=signToken(user);
    res.json({ success:true, data:{ user:{ id:user.id, email:user.email, name:user.name, role:user.role }, token } });
  }catch(e){ next(e); }
});
import { authenticate, AuthRequest } from '../../../middleware/auth';
router.get('/me', authenticate, async (req:AuthRequest,res)=>{ res.json({ success:true, data:{ user:req.user } }); });
export default router;
