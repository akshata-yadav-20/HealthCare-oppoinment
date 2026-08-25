import { Router } from 'express';
import { authenticate } from '../../../middleware/auth';
import { isMockMode, getMockStore, getPrisma } from '../../../config/prisma';
import { getAvailableSlots } from '../../../services/availability';
const router = Router();
router.get('/', async (req,res,next)=>{
  try{
    let docs:any[]=[];
    if (isMockMode()){
      const store=getMockStore();
      docs=store.doctorProfiles.map(d=>{
        const u=store.users.find(x=>x.id===d.userId);
        return { ...d, user:u };
      });
    } else {
      docs=await getPrisma().doctorProfile.findMany({ include:{ user:true } as any });
    }
    const { specialisation, date } = req.query as any;
    let filtered=docs;
    if (specialisation) filtered=filtered.filter(d=> d.specialisation.toLowerCase().includes((specialisation as string).toLowerCase()));
    res.json({ success:true, data:filtered });
  }catch(e){ next(e); }
});
router.get('/:id', async (req,res,next)=>{
  try{
    const { id }=req.params;
    let doc:any=null;
    if (isMockMode()){ const s=getMockStore(); const d=s.doctorProfiles.find(x=>x.id===id); const u=s.users.find(x=>x.id===d?.userId); doc=d?{...d,user:u}:null; }
    else { doc=await getPrisma().doctorProfile.findUnique({ where:{ id }, include:{ user:true } as any }); }
    if (!doc) return res.status(404).json({ success:false, error:'Doctor not found' });
    res.json({ success:true, data:doc });
  }catch(e){ next(e); }
});
router.get('/:id/availability', async (req,res,next)=>{
  try{
    const { id }=req.params;
    const { date }=req.query as any;
    if (!date) return res.status(400).json({ success:false, error:'date query required YYYY-MM-DD' });
    const slots=await getAvailableSlots(id, date as string);
    res.json({ success:true, data:slots });
  }catch(e){ next(e); }
});
export default router;
