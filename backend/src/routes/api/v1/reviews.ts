import { Router } from 'express';
const router = Router();
router.get('/', async (req,res)=>{ res.json({ success:true, data:[] }); });
router.post('/', async (req,res)=>{ res.status(201).json({ success:true, data:{ id:'rev_'+Date.now(), ...req.body } }); });
export default router;
