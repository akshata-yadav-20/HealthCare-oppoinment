import { useEffect, useState } from 'react';
import api from '../services/api';
import { motion } from 'framer-motion';
import { Clock, LogOut, Check, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
export default function PatientDashboard(){
  const nav=useNavigate();
  const [doctors,setDoctors]=useState<any[]>([]);
  const [selectedDoctor,setSelectedDoctor]=useState<any>(null);
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [slots,setSlots]=useState<any[]>([]);
  const [hold,setHold]=useState<any>(null);
  const [symptoms,setSymptoms]=useState('');
  const [appointments,setAppointments]=useState<any[]>([]);
  const [loadingSlots,setLoadingSlots]=useState(false);
  useEffect(()=>{ api.get('/api/v1/doctors').then(r=>setDoctors(r.data.data)); api.get('/api/v1/appointments').then(r=>setAppointments(r.data.data)); },[]);
  const loadSlots=async(doctor:any, d:string)=>{
    setSelectedDoctor(doctor); setLoadingSlots(true);
    try{ const r=await api.get(`/api/v1/doctors/${doctor.id}/availability?date=${d}`); setSlots(r.data.data); } finally{ setLoadingSlots(false); }
  };
  const holdSlot=async(slot:any)=>{
    const r=await api.post('/api/v1/appointments/hold',{doctorId:selectedDoctor.id,slotStart:slot.start});
    setHold(r.data.data);
  };
  const confirm=async()=>{
    const r=await api.post(`/api/v1/appointments/${hold.id}/confirm`,{rawSymptoms:symptoms,duration:'2 days',severity:'moderate',existingConditions:'none'});
    setHold(null); setSymptoms(''); setSlots([]); const ap=await api.get('/api/v1/appointments'); setAppointments(ap.data.data); alert('Booked! AI triage: '+(r.data.data.symptomForm?.urgencyLevel||'pending'));
  };
  return <div style={{display:'flex',minHeight:'100vh',background:'#FEFAE0'}}>
    <div style={{width:240,background:'#264653',color:'#FEFAE0',padding:24,display:'flex',flexDirection:'column',gap:20}}>
      <div style={{fontFamily:'Fraunces,serif',fontWeight:700,fontSize:22}}>CuraVia - Patient</div>
      <button className='btn' style={{background:'#2D6A4F'}} onClick={()=>nav('/')}>Home</button>
      <button className='btn' style={{background:'#FEFAE0',color:'#264653'}} onClick={()=>{localStorage.removeItem('token'); nav('/login');}}><LogOut size={14}/> Logout</button>
      <div style={{marginTop:20,background:'rgba(255,255,255,0.1)',borderRadius:12,padding:12,fontSize:13}}>
        <div style={{fontWeight:700}}>Hold TTL: 10m</div><div style={{opacity:0.8}}>Slot locked while you fill symptoms. Auto-releases.</div>
      </div>
    </div>
    <div style={{flex:1,padding:24}}>
      <h1 style={{fontFamily:'Fraunces,serif',fontSize:28,color:'#264653'}}>Find doctors</h1>
      <div style={{marginTop:16,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
        {doctors.map(d=><div key={d.id} className='card' style={{cursor:'pointer',border: selectedDoctor?.id===d.id? '2px solid #2D6A4F':'1px solid #E9E5D6'}} onClick={()=>loadSlots(d,date)}>
          <div style={{fontWeight:700,fontFamily:'Fraunces,serif'}}>{d.user?.name}</div><div style={{fontSize:13,color:'#6B7C6E'}}>{d.specialisation} - {d.slotDurationMinutes}m - ${d.consultationFee}</div><div style={{fontSize:13,marginTop:6,color:'#6B7C6E'}}>{d.bio}</div>
        </div>)}
      </div>
      {selectedDoctor && <div style={{marginTop:24}} className='card'>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h3 style={{fontFamily:'Fraunces,serif'}}>Available slots - {selectedDoctor.user?.name}</h3><input type='date' className='input' style={{width:180}} value={date} onChange={e=>{setDate(e.target.value); loadSlots(selectedDoctor,e.target.value);}} /></div>
        {loadingSlots ? <div style={{marginTop:12,display:'flex',gap:8}}>{[1,2,3,4].map(i=><div key={i} className='skeleton' style={{height:48,flex:1,borderRadius:12}} />)}</div> :
        <div style={{marginTop:12,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          {slots.length===0? <div style={{gridColumn:'1/-1',textAlign:'center',padding:20,color:'#6B7C6E'}}>No slots - on leave or fully booked</div> :
          slots.map((s:any)=><motion.button key={s.start} whileHover={{scale:1.02}} whileTap={{scale:0.98}} className='slot' onClick={()=>holdSlot(s)}><Clock size={14} style={{marginRight:6}} />{new Date(s.start).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</motion.button>)}
        </div>}
        {hold && <div style={{marginTop:16,padding:16,background:'#FEFAE0',border:'1px solid #E07A5F',borderRadius:12}}>
          <div style={{display:'flex',alignItems:'center',gap:8,fontWeight:700,color:'#9B2226'}}><AlertTriangle size={16}/> Hold: 10m - {new Date(hold.slotStart).toLocaleString()}</div>
          <textarea className='input' style={{marginTop:10,minHeight:80}} placeholder='Describe symptoms...' value={symptoms} onChange={e=>setSymptoms(e.target.value)} />
          <button className='btn btn-accent' style={{marginTop:10}} onClick={confirm}>Confirm with AI triage</button>
        </div>}
      </div>}
      <div style={{marginTop:24}} className='card'>
        <h3 style={{fontFamily:'Fraunces,serif'}}>My appointments</h3>
        <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:10}}>
          {appointments.length===0? <div style={{textAlign:'center',padding:24,color:'#6B7C6E'}}>No appointments yet - pick a doctor above.</div> :
          appointments.map((a:any)=><div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:12,border:'1px solid #E9E5D6',borderRadius:12,background:'#fff'}}>
            <div><div style={{fontWeight:600}}>{new Date(a.slotStart).toLocaleString()} - {a.status}</div><div style={{fontSize:13,color:'#6B7C6E'}}>Dr. {a.doctorId} - {a.symptomForm?.urgencyLevel? <span className={a.symptomForm.urgencyLevel==='High'?'badge-high':a.symptomForm.urgencyLevel==='Medium'?'badge-medium':'badge-low'}>{a.symptomForm.urgencyLevel}</span> : 'pending'}</div></div>
            <div style={{display:'flex',gap:8}}>{a.status==='CONFIRMED' && <button className='btn' style={{padding:'8px 12px',fontSize:13}} onClick={async()=>{ await api.post(`/api/v1/appointments/${a.id}/cancel`); const ap=await api.get('/api/v1/appointments'); setAppointments(ap.data.data); }}>Cancel</button>}</div>
          </div>)}
        </div>
        <div style={{marginTop:16,padding:12,background:'#D8F3DC',borderRadius:12}}>
          <div style={{fontWeight:600,color:'#2D6A4F',display:'flex',alignItems:'center',gap:6}}><Check size={14}/> Medication timeline</div>
          <div style={{fontSize:13,color:'#264653',marginTop:6}}>After visit, your meds appear as a checklist timeline - not raw text. Reminders sent via queued email.</div>
        </div>
      </div>
    </div>
  </div>
}
