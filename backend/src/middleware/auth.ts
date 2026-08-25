import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { isMockMode, getMockStore, getPrisma } from '../config/prisma';
export interface AuthRequest extends Request { user?: { id: string; email: string; role: string; name: string }; }
export async function authenticate(req: AuthRequest, res: Response, next: NextFunction){
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ success:false, error:'No token' });
  const token = header.split(' ')[1];
  try {
    const decoded:any = jwt.verify(token, env.JWT_SECRET);
    let user:any = null;
    if (isMockMode()){
      user = getMockStore().users.find(u=>u.id===decoded.id);
    } else {
      user = await getPrisma().user.findUnique({ where:{ id:decoded.id } });
    }
    if (!user) return res.status(401).json({ success:false, error:'User not found' });
    req.user = { id:user.id, email:user.email, role:user.role, name:user.name };
    next();
  } catch(e:any){ return res.status(401).json({ success:false, error:'Invalid token' }); }
}
export function authorize(...roles:string[]){
  return (req:AuthRequest,res:Response,next:NextFunction)=>{
    if (!req.user) return res.status(401).json({ success:false, error:'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ success:false, error:'Forbidden' });
    next();
  };
}
