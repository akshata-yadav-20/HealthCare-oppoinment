import { Router } from 'express';
const router = Router();
router.get('/', async (req,res)=>{ res.json({ success:true, data:[] }); });
router.post('/', async (req,res)=>{ res.status(201).json({ success:true, data:{ id:'wait_'+Date.now() } }); });
export default router;
