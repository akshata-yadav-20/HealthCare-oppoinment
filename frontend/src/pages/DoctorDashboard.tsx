import { useEffect, useState } from 'react';
import api from '../services/api';
import { motion } from 'framer-motion';
export default function DoctorDashboard(){
  const [appts,setAppts]=useState<any[]>([]);
  const [leaves,setLeaves]=useState<any[]>([]);
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [presc,setPresc]=useState<Record<string,string>>({});
  useEffect(()=>{ load(); api.get('/api/v1/doctor-leaves').then(r=>setLeaves(r.data.data)); },[]);
  const load=()=> api.get('/api/v1/appointments').then(r=>setAppts(r.data.data));
  const submitVisit=async(id:string)=>{
    const clinicalNotes=notes[id]||'';
    const prescription=(presc[id]||'').split(';').filter(Boolean).map(s=>{ const [drug,dosage,frequency,duration]=s.split(','); return {drug:drug||'Drug',dosage:dosage||'10mg',frequency:frequency||'daily',duration:duration||'5 days'}; });
    await api.post(`/api/v1/visits/${id}`,{clinicalNotes,prescription});
    load(); alert('Visit saved - patient-friendly summary generated');
  };
  const markLeave=async()=>{
    const d=prompt('Leave date YYYY-MM-DD'); if(!d) return;
    await api.post('/api/v1/doctor-leaves',{doctorId: appts[0]?.doctorId || 'd1', startDate:d, endDate:d});
    const r=await api.get('/api/v1/doctor-leaves'); setLeaves(r.data.data); load();
  };
  return <div style={{display:'flex',minHeight:'100vh',background:'#FEFAE0'}}>
    <div style={{width:260,background:'#2D6A4F',color:'#FEFAE0',padding:24}}>
      <div style={{fontFamily:'Fraunces,serif',fontWeight:700,fontSize:22}}>CuraVia - Doctor</div>
      <button className='btn' style={{marginTop:16,background:'#FEFAE0',color:'#2D6A4F',width:'100%'}} onClick={markLeave}>Mark Leave</button>
      <div style={{marginTop:20}}>
        <div style={{fontWeight:600}}>Leave calendar</div>
        {leaves.slice(0,5).map((l:any)=><div key={l.id} style={{marginTop:6,background:'rgba(255,255,255,0.1)',padding:8,borderRadius:8,fontSize:12}}>{new Date(l.startDate).toLocaleDateString()} - {l.reason||'Leave'}</div>)}
        {leaves.length===0 && <div style={{fontSize:13,opacity:0.7}}>No leaves</div>}
      </div>
    </div>
    <div style={{flex:1,padding:24}}>
      <h1 style={{fontFamily:'Fraunces,serif',fontSize:28,color:'#264653'}}>Today & upcoming</h1>
      <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:16}}>
        {appts.length===0? <div className='card' style={{textAlign:'center',padding:40,color:'#6B7C6E'}}>No appointments - empty state designed intentionally.</div> :
        appts.map((a:any)=><motion.div key={a.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className='card'>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontWeight:700}}>{new Date(a.slotStart).toLocaleString()} - {a.status}</div><div style={{fontSize:13,color:'#6B7C6E'}}>Patient: {a.patientId}</div></div>
            {a.symptomForm && <span className={a.symptomForm.urgencyLevel==='High'?'badge-high':a.symptomForm.urgencyLevel==='Medium'?'badge-medium':'badge-low'}>{a.symptomForm.urgencyLevel}</span>}
          </div>
          {a.symptomForm && <div style={{marginTop:12,padding:12,background:'#FEFAE0',borderRadius:12,border:'1px solid #E9E5D6'}}>
            <div style={{fontWeight:600,display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,borderRadius:'50%',background: a.symptomForm.urgencyLevel==='High'?'#9B2226':a.symptomForm.urgencyLevel==='Medium'?'#9A7B2E':'#2D6A4F',display:'inline-block'}} /> Pre-visit summary</div>
            <div style={{fontSize:13,marginTop:6}}><b>Chief complaint:</b> {a.symptomForm.structured?.chiefComplaint || a.symptomForm.rawSymptoms}</div>
            <div style={{fontSize:13,marginTop:6}}><b>3 suggested questions:</b></div>
            <ul style={{marginTop:4,paddingLeft:18,fontSize:13,lineHeight:1.6}}>
              {(a.symptomForm.structured?.suggestedQuestions || []).map((q:string,i:number)=><li key={i}>{q}</li>)}
            </ul>
            {a.symptomForm.llmStatus==='FAILED' && <div style={{marginTop:8,color:'#9B2226',fontSize:12}}>Summary unavailable - retry state (booking not blocked)</div>}
          </div>}
          {a.status==='CONFIRMED' && <div style={{marginTop:12}}>
            <textarea className='input' placeholder='Clinical notes...' value={notes[a.id]||''} onChange={e=>setNotes({...notes,[a.id]:e.target.value})} />
            <input className='input' style={{marginTop:8}} placeholder='Prescription: drug,dosage,frequency,duration; ...' value={presc[a.id]||''} onChange={e=>setPresc({...presc,[a.id]:e.target.value})} />
            <button className='btn' style={{marginTop:8}} onClick={()=>submitVisit(a.id)}>Submit visit + generate patient summary</button>
          </div>}
          {a.visitNote && <div style={{marginTop:12,padding:12,background:'#D8F3DC',borderRadius:12}}>
            <div style={{fontWeight:600,color:'#2D6A4F'}}>Post-visit summary</div>
            <div style={{fontSize:13,marginTop:6,whiteSpace:'pre-wrap'}}>{a.visitNote.patientSummary}</div>
            {a.visitNote.llmStatus==='FAILED' && <div style={{fontSize:12,color:'#9B2226',marginTop:6}}>Patient summary pending - retry</div>}
          </div>}
        </motion.div>)}
      </div>
    </div>
  </div>
}
