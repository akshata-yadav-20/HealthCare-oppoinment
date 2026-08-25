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
    if (store.users.length>0) { logger.info('Mock DB already seeded'); return; }
    const adminPass=await bcrypt.hash('admin123',10);
    const docPass=await bcrypt.hash('doctor123',10);
    const patPass=await bcrypt.hash('patient123',10);
    const admin={ id:'u_admin', email:'cura.admin@curavia.health', password:adminPass, name:'Admin Cura', role:'ADMIN', createdAt:new Date() };
    const pat1={ id:'u_pat1', email:'sofia@curavia.health', password:patPass, name:'Sofia Rivera', role:'PATIENT', createdAt:new Date() };
    const pat2={ id:'u_pat2', email:'marcus@curavia.health', password:patPass, name:'Marcus Chen', role:'PATIENT', createdAt:new Date() };
    const docU1={ id:'u_doc1', email:'elena.rossi@curavia.health', password:docPass, name:'Dr. Elena Rossi', role:'DOCTOR', createdAt:new Date() };
    const docU2={ id:'u_doc2', email:'amir.khan@curavia.health', password:docPass, name:'Dr. Amir Khan', role:'DOCTOR', createdAt:new Date() };
    const docU3={ id:'u_doc3', email:'priya.desai@curavia.health', password:docPass, name:'Dr. Priya Desai', role:'DOCTOR', createdAt:new Date() };
    store.users.push(admin, pat1, pat2, docU1, docU2, docU3);
    store.doctorProfiles.push(
      { id:'d1', userId:docU1.id, specialisation:'Cardiology', workingHours:workingHoursDefault, slotDurationMinutes:30, consultationFee:650, bio:'Interventional cardiology, 12y exp', createdAt:new Date() },
      { id:'d2', userId:docU2.id, specialisation:'Dermatology', workingHours:workingHoursDefault, slotDurationMinutes:20, consultationFee:450, bio:'Cosmetic & clinical dermatology', createdAt:new Date() },
      { id:'d3', userId:docU3.id, specialisation:'General Medicine', workingHours:workingHoursDefault, slotDurationMinutes:25, consultationFee:350, bio:'Primary care & preventive', createdAt:new Date() },
    );
    logger.info('CuraVia Mock DB seeded: cura.admin@curavia.health / sofia@ / marcus@ / elena/amir/priya');
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
