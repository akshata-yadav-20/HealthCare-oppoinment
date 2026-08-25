import { useEffect, useState } from 'react';
import api from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
export default function AdminDashboard(){
  const [stats,setStats]=useState<any>(null);
  const [appts,setAppts]=useState<any[]>([]);
  const [logs,setLogs]=useState<any[]>([]);
  const [doctors,setDoctors]=useState<any[]>([]);
  const [form,setForm]=useState({email:'',password:'',name:'',specialisation:'Cardiology',slotDurationMinutes:30,consultationFee:500});
  useEffect(()=>{ api.get('/api/v1/admin/stats').then(r=>setStats(r.data.data)); api.get('/api/v1/admin/appointments').then(r=>setAppts(r.data.data)); api.get('/api/v1/admin/notifications').then(r=>setLogs(r.data.data)); api.get('/api/v1/doctors').then(r=>setDoctors(r.data.data)); },[]);
  const createDoctor=async(e:any)=>{
    e.preventDefault();
    await api.post('/api/v1/admin/doctors',form);
    const r=await api.get('/api/v1/doctors'); setDoctors(r.data.data); alert('Doctor created');
  };
  const urgencyData=stats? [{name:'Low',value:3},{name:'Medium',value:5},{name:'High',value:2}] : [];
  const COLORS=['#2D6A4F','#E07A5F','#9B2226'];
  return <div style={{padding:24,background:'#FEFAE0',minHeight:'100vh'}}>
    <h1 style={{fontFamily:'Fraunces,serif',fontSize:28,color:'#264653'}}>CuraVia - Admin</h1>
    {stats && <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginTop:16}}>
      {[{k:'Users',v:stats.users},{k:'Doctors',v:stats.doctors},{k:'Appointments',v:stats.appointments},{k:'Failed jobs',v:stats.failedNotifications}].map(s=><div key={s.k} className='card' style={{textAlign:'center',borderTop:'4px solid #2D6A4F'}}><div style={{fontSize:28,fontWeight:700,fontFamily:'Fraunces,serif',color:'#2D6A4F'}}>{s.v}</div><div style={{fontSize:13,color:'#6B7C6E'}}>{s.k}</div></div>)}
    </div>}
    <div style={{marginTop:20,display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div className='card'><h3 style={{fontFamily:'Fraunces,serif'}}>Urgency distribution</h3><div style={{height:220}}><ResponsiveContainer width='100%' height='100%'><PieChart><Pie data={urgencyData} dataKey='value' cx='50%' cy='50%' outerRadius={80} label>{urgencyData.map((_,i)=><Cell key={i} fill={COLORS[i%3]} />)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div></div>
      <div className='card'><h3 style={{fontFamily:'Fraunces,serif'}}>Create doctor</h3><form onSubmit={createDoctor} style={{marginTop:12,display:'flex',flexDirection:'column',gap:8}}>
        <input className='input' placeholder='Email' value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
        <input className='input' placeholder='Password' value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
        <input className='input' placeholder='Name' value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
        <input className='input' placeholder='Specialisation' value={form.specialisation} onChange={e=>setForm({...form,specialisation:e.target.value})} />
        <div style={{display:'flex',gap:8}}><input className='input' placeholder='Slot min' type='number' value={form.slotDurationMinutes} onChange={e=>setForm({...form,slotDurationMinutes:parseInt(e.target.value)||30})} /><input className='input' placeholder='Fee' type='number' value={form.consultationFee} onChange={e=>setForm({...form,consultationFee:parseInt(e.target.value)||500})} /></div>
        <button className='btn' type='submit'>Create</button>
      </form></div>
    </div>
    <div className='card' style={{marginTop:16}}>
      <h3 style={{fontFamily:'Fraunces,serif'}}>Doctors</h3>
      <div style={{marginTop:12,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
        {doctors.map((d:any)=><div key={d.id} style={{padding:12,border:'1px solid #E9E5D6',borderRadius:12,background:'#fff'}}><div style={{fontWeight:700}}>{d.user?.name}</div><div style={{fontSize:13,color:'#6B7C6E'}}>{d.specialisation} - {d.slotDurationMinutes}m</div></div>)}
      </div>
    </div>
    <div className='card' style={{marginTop:16}}>
      <h3 style={{fontFamily:'Fraunces,serif'}}>All appointments</h3>
      <table className='table' style={{marginTop:12}}><thead><tr><th>Date</th><th>Patient</th><th>Doctor</th><th>Status</th></tr></thead><tbody>{appts.slice(0,10).map((a:any)=><tr key={a.id}><td>{new Date(a.slotStart).toLocaleDateString()}</td><td>{a.patientId.slice(0,6)}</td><td>{a.doctorId}</td><td><span className={a.status==='CONFIRMED'?'badge-low':a.status==='CANCELLED'?'badge-high':'badge-medium'}>{a.status}</span></td></tr>)}</tbody></table>
    </div>
    <div className='card' style={{marginTop:16}}>
      <h3 style={{fontFamily:'Fraunces,serif'}}>Notification log (dead-letter visible)</h3>
      <table className='table' style={{marginTop:12}}><thead><tr><th>Type</th><th>Recipient</th><th>Status</th><th>Retry</th></tr></thead><tbody>{logs.slice(0,10).map((n:any)=><tr key={n.id}><td>{n.type}</td><td>{n.recipient}</td><td>{n.status}</td><td>{n.retryCount}</td></tr>)}</tbody></table>
    </div>
  </div>
}
