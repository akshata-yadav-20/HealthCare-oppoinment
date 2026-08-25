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
    if (isMockMode()){ user=getMockStore().users.find(u=>u.email===body.email); }
    else { user=await getPrisma().user.findUnique({ where:{ email:body.email } }); }
    if (!user) return res.status(401).json({ success:false, error:'Invalid credentials' });
    const ok=await bcrypt.compare(body.password, user.password);
    if (!ok) return res.status(401).json({ success:false, error:'Invalid credentials' });
    const token=signToken(user);
    res.json({ success:true, data:{ user:{ id:user.id, email:user.email, name:user.name, role:user.role }, token } });
  }catch(e){ next(e); }
});
import { authenticate, AuthRequest } from '../../../middleware/auth';
router.get('/me', authenticate, async (req:AuthRequest,res)=>{ res.json({ success:true, data:{ user:req.user } }); });
export default router;
