import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
export default function Login(){
  const [email,setEmail]=useState('cura.admin@curavia.health');
  const [password,setPassword]=useState('admin123');
  const { login, loading }=useAuth();
  const nav=useNavigate();
  const [err,setErr]=useState('');
  const submit=async(e:any)=>{
    e.preventDefault(); setErr('');
    try{ await login(email,password); const token=localStorage.getItem('token'); const payload=JSON.parse(atob(token!.split('.')[1])); if(payload.role==='ADMIN') nav('/admin'); else if(payload.role==='DOCTOR') nav('/doctor'); else nav('/patient'); }
    catch(e:any){ setErr(e.response?.data?.error||'Login failed'); }
  };
  return <div style={{minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 1fr',background:'#FEFAE0'}}>
    <div style={{padding:'40px 50px',display:'flex',flexDirection:'column',justifyContent:'center',background:'linear-gradient(135deg,#2D6A4F,#40916C)',color:'#FEFAE0'}}>
      <h1 style={{fontFamily:'Fraunces,serif',fontSize:42}}>Welcome back to CuraVia</h1>
      <p style={{marginTop:12,opacity:0.9}}>Sage-trusted care, clay-warm follow-ups. Hold-protected bookings, AI triage.</p>
      <div style={{marginTop:24,background:'rgba(255,255,255,0.15)',borderRadius:16,padding:16,border:'1px solid rgba(255,255,255,0.2)'}}>
        <div style={{fontWeight:700}}>Demo accounts</div>
        <div style={{fontSize:13,marginTop:6,lineHeight:1.6}}>Admin: cura.admin@curavia.health / admin123<br/>Patient: sofia@curavia.health / patient123<br/>Doctor: elena.rossi@curavia.health / doctor123</div>
      </div>
    </div>
    <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} style={{padding:'40px 50px',display:'flex',flexDirection:'column',justifyContent:'center',background:'#fff'}}>
      <h2 style={{fontFamily:'Fraunces,serif',fontSize:28,color:'#264653'}}>Sign in</h2>
      <form onSubmit={submit} style={{marginTop:20,display:'flex',flexDirection:'column',gap:14}}>
        <input className='input' placeholder='Email' value={email} onChange={e=>setEmail(e.target.value)} />
        <input className='input' placeholder='Password' type='password' value={password} onChange={e=>setPassword(e.target.value)} />
        {err && <div style={{color:'#9B2226',background:'#FADCD9',padding:10,borderRadius:10,fontSize:13}}>{err}</div>}
        <button className='btn' disabled={loading} type='submit'>{loading?'Signing in...':'Sign in'}</button>
        <div style={{fontSize:13,textAlign:'center',color:'#6B7C6E'}}>No account? <Link to='/register' style={{color:'#2D6A4F',fontWeight:600}}>Register</Link></div>
      </form>
    </motion.div>
  </div>
}
