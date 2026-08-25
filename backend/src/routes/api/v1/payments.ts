import { Router } from 'express';
const router = Router();
router.get('/', async (req,res)=>{ res.json({ success:true, data:[] }); });
router.post('/create', async (req,res)=>{ res.json({ success:true, data:{ id:'pay_'+Date.now(), status:'stub' } }); });
export default router;
