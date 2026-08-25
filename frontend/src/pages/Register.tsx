import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function Register(){
  const [form,setForm]=useState({name:'',email:'',password:'',role:'PATIENT'});
  const { register, loading }=useAuth();
  const nav=useNavigate();
  const [err,setErr]=useState('');
  const submit=async(e:any)=>{
    e.preventDefault(); setErr('');
    try{ await register(form); nav('/patient'); } catch(e:any){ setErr(e.response?.data?.error||'Register failed'); }
  };
  return <div style={{minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 1fr',background:'#FEFAE0'}}>
    <div style={{padding:'40px 50px',display:'flex',flexDirection:'column',justifyContent:'center',background:'linear-gradient(135deg,#E07A5F,#F4ACB7)',color:'#fff'}}>
      <h1 style={{fontFamily:'Fraunces,serif',fontSize:42}}>Join CuraVia</h1>
      <p style={{marginTop:12}}>Create your account — sage care, clay comfort, hold-secured slots.</p>
    </div>
    <div style={{padding:'40px 50px',display:'flex',flexDirection:'column',justifyContent:'center',background:'#fff'}}>
      <h2 style={{fontFamily:'Fraunces,serif',fontSize:28,color:'#264653'}}>Create account</h2>
      <form onSubmit={submit} style={{marginTop:20,display:'flex',flexDirection:'column',gap:12}}>
        <input className='input' placeholder='Full name' value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
        <input className='input' placeholder='Email' value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
        <input className='input' placeholder='Password' type='password' value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
        <select className='input' value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value='PATIENT'>Patient</option><option value='DOCTOR'>Doctor</option></select>
        {err && <div style={{color:'#9B2226',background:'#FADCD9',padding:10,borderRadius:10,fontSize:13}}>{err}</div>}
        <button className='btn' disabled={loading} type='submit'>{loading?'Creating...':'Create account'}</button>
        <div style={{fontSize:13,textAlign:'center',color:'#6B7C6E'}}>Have account? <Link to='/login' style={{color:'#2D6A4F',fontWeight:600}}>Login</Link></div>
      </form>
    </div>
  </div>
}
