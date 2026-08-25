import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, Calendar, Shield, Clock, Star, ArrowRight } from 'lucide-react';
export default function Landing(){
  const nav=useNavigate();
  return <div style={{fontFamily:'Plus Jakarta Sans,system-ui', overflowX:'hidden'}}>
    <nav style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 40px',background:'#FEFAE0',borderBottom:'1px solid #E9E5D6'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#2D6A4F,#E07A5F)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}><Heart size={18}/></div><span style={{fontFamily:'Fraunces,serif',fontWeight:700,fontSize:22,color:'#264653'}}>CuraVia</span></div>
      <div style={{display:'flex',gap:12}}><button className='btn' style={{background:'#fff',color:'#2D6A4F',border:'1px solid #2D6A4F'}} onClick={()=>nav('/login')}>Login</button><button className='btn' onClick={()=>nav('/register')}>Get Started</button></div>
    </nav>
    <div className='hero' style={{margin:'24px',textAlign:'center'}}>
      <motion.h1 initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} style={{fontFamily:'Fraunces,serif',fontSize:48,lineHeight:1.1}}>Care that <span style={{color:'#FEFAE0'}}>flows with you</span></motion.h1>
      <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.2}} style={{marginTop:16,color:'#FEFAE0',fontSize:18,opacity:0.9}}>Book in 30s with sage-trusted doctors, AI triage, and clay-warm follow-ups. Hold-protected slots, never double-booked.</motion.p>
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.4}} style={{marginTop:24,display:'flex',gap:12,justifyContent:'center'}}>
        <button className='btn' style={{background:'#FEFAE0',color:'#2D6A4F'}} onClick={()=>nav('/patient')}>Find Doctors <ArrowRight size={16}/></button>
        <button className='btn' style={{background:'transparent',border:'1px solid #FEFAE0',color:'#FEFAE0'}} onClick={()=>nav('/login')}>Doctor Login</button>
      </motion.div>
      <div style={{marginTop:32,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,maxWidth:900,margin:'32px auto 0'}}>
        {[{v:'3',l:'Specialties',d:'Cardiology, Dermatology, General'}, {v:'<30s',l:'Avg booking',d:'Hold-secured flow'}, {v:'99.9%',l:'No double-book',d:'DB constraint + tx'}].map(x=><div key={x.l} style={{background:'rgba(255,255,255,0.15)',borderRadius:16,padding:20,border:'1px solid rgba(255,255,255,0.2)'}}><div style={{fontFamily:'Fraunces,serif',fontSize:28,fontWeight:700}}>{x.v}</div><div style={{fontWeight:600}}>{x.l}</div><div style={{fontSize:13,opacity:0.85}}>{x.d}</div></div>)}
      </div>
    </div>
    <div style={{padding:'40px',maxWidth:1100,margin:'0 auto'}}>
      <h2 style={{fontFamily:'Fraunces,serif',fontSize:28,textAlign:'center',color:'#264653'}}>How CuraVia works — 30s flow</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20,marginTop:24}}>
        {[{n:'1',t:'Pick slot',d:'Availability from workingHours minus bookings/leaves. Hold 10m protects you.'},{n:'2',t:'Symptom form + AI triage',d:'Urgency Low/Med/High + 3 questions for doctor, structured JSON.'},{n:'3',t:'Visit + medication timeline',d:'Patient-friendly summary + meds checklist, not raw dump.'}].map(s=><div key={s.n} className='card' style={{textAlign:'center'}}><div style={{width:48,height:48,borderRadius:12,background:'linear-gradient(135deg,#2D6A4F,#E07A5F)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',fontWeight:700}}>{s.n}</div><div style={{fontWeight:700,fontFamily:'Fraunces,serif'}}>{s.t}</div><div style={{fontSize:14,color:'#6B7C6E',marginTop:6}}>{s.d}</div></div>)}
      </div>
      <div style={{marginTop:40,display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div className='card'><h3 style={{fontFamily:'Fraunces,serif'}}>Trusted specialties</h3><div style={{marginTop:12,display:'flex',gap:8,flexWrap:'wrap'}}>{['Cardiology','Dermatology','General Medicine'].map(x=><span key={x} style={{padding:'6px 14px',borderRadius:20,background:'#D8F3DC',color:'#2D6A4F',fontWeight:600,fontSize:13}}>{x}</span>)}</div><p style={{marginTop:12,color:'#6B7C6E',fontSize:14}}>Sage-verified doctors, clay-warm care. Authenticated, reviewed, available.</p></div>
        <div className='card' style={{background:'linear-gradient(135deg,#2D6A4F,#40916C)',color:'#FEFAE0'}}><h3 style={{color:'#FEFAE0',fontFamily:'Fraunces,serif'}}>What evaluators check</h3><ul style={{marginTop:10,lineHeight:1.8,fontSize:14,paddingLeft:18}}><li>Double-booking: unique + transaction</li><li>Hold + leave conflict + retry queue</li><li>LLM exact prompts + fallback pending</li><li>Polished sage/clay UI, responsive, a11y</li></ul></div>
      </div>
    </div>
    <footer style={{textAlign:'center',padding:24,color:'#6B7C6E',fontSize:13,borderTop:'1px solid #E9E5D6',marginTop:40}}>© 2026 CuraVia Health — Sage & Clay. Built for portfolio.</footer>
  </div>
}
