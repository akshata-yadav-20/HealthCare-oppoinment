import { Router } from 'express';
import { authenticate, AuthRequest } from '../../../middleware/auth';
import { env } from '../../../config/env';
const router = Router();
router.get('/auth', authenticate, async (req:AuthRequest,res)=>{
  if (!env.GOOGLE_CLIENT_ID) return res.json({ success:true, data:{ stub:true, message:'Calendar stub - no GOOGLE_CLIENT_ID' } });
  const url='https://accounts.google.com/o/oauth2/v2/auth?client_id=' + env.GOOGLE_CLIENT_ID + '&redirect_uri=' + env.GOOGLE_REDIRECT_URI + '&response_type=code&scope=https://www.googleapis.com/auth/calendar&access_type=offline&prompt=consent';
  res.json({ success:true, data:{ url } });
});
router.get('/callback', async (req,res)=>{ res.json({ success:true, data:{ stub:true } }); });
router.get('/status', authenticate, async (req:AuthRequest,res)=>{ res.json({ success:true, data:{ connected: !!env.GOOGLE_CLIENT_ID, stub: !env.GOOGLE_CLIENT_ID } }); });
export default router;
