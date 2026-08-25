#!/usr/bin/env node
const BASE = process.env.BASE_URL || 'http://localhost:4001';
async function req(path, opts={}){
  const headers={'Content-Type':'application/json',...(opts.headers||{})};
  const {headers:_h,...rest}=opts;
  const res=await fetch(BASE + path,{headers,...rest});
  const text=await res.text();
  let json; try{json=JSON.parse(text);}catch{json={raw:text};}
  return {status:res.status,json,text};
}
async function login(email,password){
  const {status,json}=await req('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email,password})});
  if(status!==200) throw new Error('login failed '+JSON.stringify(json));
  return json.data.token;
}
async function registerIfNeeded(email,password,name){
  await req('/api/v1/auth/register',{method:'POST',body:JSON.stringify({email,password,name})});
}
(async()=>{
  console.log('=== Concurrent Booking Test CuraVia ===');
  await registerIfNeeded('sofia@curavia.health','patient123','Sofia Rivera');
  await registerIfNeeded('marcus@curavia.health','patient123','Marcus Chen');
  const token1=await login('sofia@curavia.health','patient123');
  const token2=await login('marcus@curavia.health','patient123');
  const doctorsRes=await req('/api/v1/doctors',{headers:{Authorization:`Bearer ${token1}`}});
  const doctor=doctorsRes.json.data[0];
  console.log('Doctor',doctor.id,doctor.specialisation);
  const tomorrow=new Date(Date.now()+24*3600000).toISOString().slice(0,10);
  const availRes=await req(`/api/v1/doctors/${doctor.id}/availability?date=${tomorrow}`,{headers:{Authorization:`Bearer ${token1}`}});
  if(!availRes.json.data || availRes.json.data.length===0){ console.error('No slots', JSON.stringify(availRes.json).slice(0,500)); process.exit(1); }
  const slot=availRes.json.data[0];
  console.log('Slot',slot);
  const p1=req('/api/v1/appointments/hold',{method:'POST',headers:{Authorization:`Bearer ${token1}`},body:JSON.stringify({doctorId:doctor.id,slotStart:slot.start})});
  const p2=req('/api/v1/appointments/hold',{method:'POST',headers:{Authorization:`Bearer ${token2}`},body:JSON.stringify({doctorId:doctor.id,slotStart:slot.start})});
  const [r1,r2]=await Promise.all([p1,p2]);
  console.log('Hold1',r1.status, JSON.stringify(r1.json).slice(0,200)); console.log('Hold2',r2.status, JSON.stringify(r2.json).slice(0,200));
  const successes=[r1,r2].filter(r=>r.status===201).length;
  const conflicts=[r1,r2].filter(r=>r.status===409).length;
  console.log(`${successes} success, ${conflicts} conflict`);
  if(successes===1 && conflicts===1){
    console.log('PASS concurrent');
    const winner=r1.status===201?{token:token1,res:r1}:{token:token2,res:r2};
    const holdId=winner.res.json.data.id;
    const confirmRes=await req(`/api/v1/appointments/${holdId}/confirm`,{method:'POST',headers:{Authorization:`Bearer ${winner.token}`},body:JSON.stringify({rawSymptoms:'Headache and fever for 2 days',duration:'2 days',severity:'moderate',existingConditions:'none'})});
    console.log('Confirm',confirmRes.status, JSON.stringify(confirmRes.json).slice(0,300));
    console.log('PASS overall'); process.exit(0);
  } else { console.error('FAIL - expected 1 success 1 conflict'); process.exit(1); }
})().catch(e=>{console.error(e);process.exit(1);});
