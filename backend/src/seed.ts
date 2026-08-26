import bcrypt from 'bcryptjs';
import { isMockMode, getMockStore, getPrisma } from './config/prisma';
import { logger } from './config/logger';
const workingHoursDefault = {
  monday: { start:"09:00", end:"17:00", enabled:true },
  tuesday: { start:"09:00", end:"17:00", enabled:true },
  wednesday: { start:"09:00", end:"17:00", enabled:true },
  thursday: { start:"09:00", end:"17:00", enabled:true },
  friday: { start:"09:00", end:"17:00", enabled:true },
  saturday: { start:"09:00", end:"13:00", enabled:true },
  sunday: { start:"09:00", end:"13:00", enabled:false },
};
export async function seedIfNeeded(){
  if (isMockMode()){
    const store=getMockStore();
    // Ensure demo users exist even if store already has some users (for Vercel serverless per-invocation)
    const ensureUser = async (email:string, password:string, name:string, role:string, id:string) => {
      if (!store.users.find(u=>u.email===email)) {
        const hash = await bcrypt.hash(password, 10);
        const user = { id, email, password: hash, name, role, createdAt: new Date() };
        store.users.push(user);
        return user;
      }
      return store.users.find(u=>u.email===email);
    };
    const admin = await ensureUser('cura.admin@curavia.health', 'admin123', 'Admin Cura', 'ADMIN', 'u_admin');
    const pat1 = await ensureUser('sofia@curavia.health', 'patient123', 'Sofia Rivera', 'PATIENT', 'u_pat1');
    const pat2 = await ensureUser('marcus@curavia.health', 'patient123', 'Marcus Chen', 'PATIENT', 'u_pat2');
    const docU1 = await ensureUser('elena.rossi@curavia.health', 'doctor123', 'Dr. Elena Rossi', 'DOCTOR', 'u_doc1');
    const docU2 = await ensureUser('amir.khan@curavia.health', 'doctor123', 'Dr. Amir Khan', 'DOCTOR', 'u_doc2');
    const docU3 = await ensureUser('priya.desai@curavia.health', 'doctor123', 'Dr. Priya Desai', 'DOCTOR', 'u_doc3');
    // Ensure doctor profiles
    const ensureProfile = (id:string, userId:string, spec:string, fee:number, bio:string, duration:number) => {
      if (!store.doctorProfiles.find(d=>d.id===id)) {
        store.doctorProfiles.push({ id, userId, specialisation: spec, workingHours: workingHoursDefault, slotDurationMinutes: duration, consultationFee: fee, bio, createdAt: new Date() });
      }
    };
    ensureProfile('d1', 'u_doc1', 'Cardiology', 650, 'Interventional cardiology, 12y exp', 30);
    ensureProfile('d2', 'u_doc2', 'Dermatology', 450, 'Cosmetic & clinical dermatology', 20);
    ensureProfile('d3', 'u_doc3', 'General Medicine', 350, 'Primary care & preventive', 25);
    if (store.users.length>=6) logger.info('CuraVia Mock DB ensured: cura.admin@curavia.health / sofia@ / marcus@ / elena/amir/priya');
    else logger.info('CuraVia Mock DB seeded');
  } else {
    const prisma=getPrisma();
    const count=await prisma.user.count();
    if (count>0) { logger.info('DB already seeded'); return; }
    const adminPass=await bcrypt.hash('admin123',10);
    const docPass=await bcrypt.hash('doctor123',10);
    const patPass=await bcrypt.hash('patient123',10);
    const admin=await prisma.user.create({ data:{ email:'cura.admin@curavia.health', password:adminPass, name:'Admin Cura', role:'ADMIN' as any } });
    const pat1=await prisma.user.create({ data:{ email:'sofia@curavia.health', password:patPass, name:'Sofia Rivera', role:'PATIENT' as any } });
    const docU1=await prisma.user.create({ data:{ email:'elena.rossi@curavia.health', password:docPass, name:'Dr. Elena Rossi', role:'DOCTOR' as any } });
    await prisma.doctorProfile.create({ data:{ userId:docU1.id, specialisation:'Cardiology', workingHours:workingHoursDefault as any, slotDurationMinutes:30, consultationFee:650, bio:'Interventional cardiology' } as any });
    const docU2=await prisma.user.create({ data:{ email:'amir.khan@curavia.health', password:docPass, name:'Dr. Amir Khan', role:'DOCTOR' as any } });
    await prisma.doctorProfile.create({ data:{ userId:docU2.id, specialisation:'Dermatology', workingHours:workingHoursDefault as any, slotDurationMinutes:20, consultationFee:450 } as any });
    logger.info('Postgres seeded CuraVia');
  }
}
if (require.main===module){ seedIfNeeded().then(()=>{ console.log('seed done'); process.exit(0); }).catch(e=>{ console.error(e); process.exit(1); }); }
