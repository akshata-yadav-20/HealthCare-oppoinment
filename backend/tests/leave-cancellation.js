#!/usr/bin/env node
const BASE=process.env.BASE_URL||'http://localhost:4001';
async function req(path,opts={}){
  const h={'Content-Type':'application/json',...(opts.headers||{})};
  const {headers:_h,...rest}=opts;
  const res=await fetch(BASE + path,{headers:h,...rest});
  const t=await res.text(); let j; try{j=JSON.parse(t);}catch{j={raw:t};}
  return {status:res.status,json:j};
}
async function login(email,password){
  const {status,json}=await req('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email,password})});
  if(status!==200) throw new Error('login fail '+JSON.stringify(json));
  return json.data.token;
}
(async()=>{
  console.log('=== Leave Cancellation Test CuraVia ===');
  const adminToken=await login('cura.admin@curavia.health','admin123');
  const patToken=await login('sofia@curavia.health','patient123');
  const doctorsRes=await req('/api/v1/doctors',{headers:{Authorization:`Bearer ${adminToken}`}});
  const doctor=doctorsRes.json.data[0];
  console.log('Doctor',doctor.id);
  const day2=new Date(Date.now()+2*24*3600000).toISOString().slice(0,10);
  const avail=await req(`/api/v1/doctors/${doctor.id}/availability?date=${day2}`,{headers:{Authorization:`Bearer ${patToken}`}});
  const slot=avail.json.data[0];
  if(!slot){ console.error('no slot for day2', JSON.stringify(avail.json).slice(0,300)); process.exit(1); }
  console.log('Slot',slot.start);
  const hold=await req('/api/v1/appointments/hold',{method:'POST',headers:{Authorization:`Bearer ${patToken}`},body:JSON.stringify({doctorId:doctor.id,slotStart:slot.start})});
  if(hold.status!==201){ console.error('hold fail',hold.json); process.exit(1); }
  const holdId=hold.json.data.id;
  console.log('Hold',holdId);
  const confirm=await req(`/api/v1/appointments/${holdId}/confirm`,{method:'POST',headers:{Authorization:`Bearer ${patToken}`},body:JSON.stringify({rawSymptoms:'Fever',duration:'1 day',severity:'mild',existingConditions:'none'})});
  console.log('Confirm',confirm.status);
  if(confirm.status!==200 && confirm.status!==201){ console.error('confirm fail',confirm.json); process.exit(1); }
  const leave=await req('/api/v1/doctor-leaves',{method:'POST',headers:{Authorization:`Bearer ${adminToken}`},body:JSON.stringify({doctorId:doctor.id,startDate:day2,endDate:day2,reason:'Test leave'})});
  console.log('Leave',leave.status,JSON.stringify(leave.json).slice(0,500));
  const cancelled=leave.json.data?.cancelledCount ?? leave.json.data?.cancelled?.length ?? 0;
  console.log('Cancelled',cancelled);
  // Check appointment is cancelled
  const apptCheck=await req(`/api/v1/appointments/${holdId}`,{headers:{Authorization:`Bearer ${patToken}`}});
  console.log('Appt status after leave',apptCheck.json.data?.status);
  if(cancelled>=1 || apptCheck.json.data?.status==='CANCELLED'){ console.log('PASS leave'); process.exit(0);} else { console.error('FAIL leave not cancelled'); process.exit(1); }
})().catch(e=>{console.error(e);process.exit(1);});
