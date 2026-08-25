#!/usr/bin/env node
const BASE=process.env.BASE_URL||'http://localhost:4001';
async function req(p,o={}){ const h={'Content-Type':'application/json',...(o.headers||{})}; const {headers:_h,...rest}=o; const res=await fetch(BASE + p,{headers:h,...rest}); const t=await res.text(); let j; try{j=JSON.parse(t);}catch{j={raw:t};}
 return {status:res.status,json:j};}
async function login(e,pw){ const {status,json}=await req('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email:e,password:pw})}); if(status!==200) throw new Error('login fail '+JSON.stringify(json)); return json.data.token; }
(async()=>{
  console.log('=== LLM Fallback Test CuraVia ===');
  const email=`llm_${Date.now()}@curavia.health`;
  await req('/api/v1/auth/register',{method:'POST',body:JSON.stringify({email,password:'patient123',name:'LLM Patient'})});
  const token=await login(email,'patient123');
  const docs=await req('/api/v1/doctors',{headers:{Authorization:`Bearer ${token}`}});
  const doctor=docs.json.data[0];
  console.log('Doctor',doctor.id);
  const d3=new Date(Date.now()+3*24*3600000).toISOString().slice(0,10);
  const avail=await req(`/api/v1/doctors/${doctor.id}/availability?date=${d3}`,{headers:{Authorization:`Bearer ${token}`}});
  if(!avail.json.data || avail.json.data.length===0){ console.error('No slot for d3', JSON.stringify(avail.json).slice(0,300)); process.exit(1); }
  const slot=avail.json.data[0];
  console.log('Slot',slot.start);
  const hold=await req('/api/v1/appointments/hold',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({doctorId:doctor.id,slotStart:slot.start})});
  console.log('Hold',hold.status, JSON.stringify(hold.json).slice(0,200));
  if(hold.status!==201){ console.error('hold fail'); process.exit(1); }
  const holdId=hold.json.data.id;
  const confirm=await req(`/api/v1/appointments/${holdId}/confirm`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({rawSymptoms:'Severe chest pain and difficulty breathing',duration:'2 hours',severity:'severe',existingConditions:'none'})});
  console.log('Confirm',confirm.status,JSON.stringify(confirm.json).slice(0,600));
  if(confirm.status===200||confirm.status===201){
    // Use the returned symptomForm directly or fetch appointment
    const sf = confirm.json.data?.symptomForm || confirm.json.data?.appointment;
    const detail=await req(`/api/v1/appointments/${holdId}`,{headers:{Authorization:`Bearer ${token}`}});
    console.log('Detail symptomForm', JSON.stringify(detail.json.data?.symptomForm||{}).slice(0,400));
    const llmStatus = detail.json.data?.symptomForm?.llmStatus || confirm.json.data?.symptomForm?.llmStatus;
    const urgency = detail.json.data?.symptomForm?.urgencyLevel || confirm.json.data?.symptomForm?.urgencyLevel;
    console.log('LLM status',llmStatus,'urgency',urgency);
    console.log('PASS llm fallback - booking succeeded despite LLM stub/failure');
    // Try visit note creation (post-visit) - may need doctor token, so just try
    try{
      const docToken=await login('elena.rossi@curavia.health','doctor123');
      const visit=await req(`/api/v1/visits/${holdId}`,{method:'POST',headers:{Authorization:`Bearer ${docToken}`},body:JSON.stringify({clinicalNotes:'Patient has hypertension, prescribe Lisinopril 10mg once daily for 30 days',prescription:[{drug:'Lisinopril',dosage:'10mg',frequency:'once daily',duration:'30 days'}]})});
      console.log('Visit',visit.status, JSON.stringify(visit.json).slice(0,300));
    }catch(e){ console.log('Visit step skipped', e.message); }
    process.exit(0);
  } else { console.error('FAIL confirm not 200', confirm.json); process.exit(1); }
})().catch(e=>{console.error(e);process.exit(1);});
