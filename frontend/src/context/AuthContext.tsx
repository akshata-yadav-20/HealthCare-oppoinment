import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
type User = { id:string; email:string; name:string; role:string };
type Ctx = { user:User|null; token:string|null; login:(email:string,pass:string)=>Promise<void>; register:(data:any)=>Promise<void>; logout:()=>void; loading:boolean };
const AuthContext = createContext<Ctx>(null as any);
export const AuthProvider:React.FC<{children:React.ReactNode}> = ({children})=>{
  const [user,setUser]=useState<User|null>(null);
  const [token,setToken]=useState<string|null>(()=>localStorage.getItem('token'));
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if(token){
      api.get('/api/v1/auth/me').then(r=>setUser(r.data.data.user)).catch(()=>{ localStorage.removeItem('token'); setToken(null); });
    }
  },[token]);
  const login=async(email:string,password:string)=>{
    setLoading(true);
    try{ const r=await api.post('/api/v1/auth/login',{email,password}); localStorage.setItem('token',r.data.data.token); setToken(r.data.data.token); setUser(r.data.data.user); } finally{ setLoading(false); }
  };
  const register=async(data:any)=>{
    setLoading(true);
    try{ const r=await api.post('/api/v1/auth/register',data); localStorage.setItem('token',r.data.data.token); setToken(r.data.data.token); setUser(r.data.data.user); } finally{ setLoading(false); }
  };
  const logout=()=>{ localStorage.removeItem('token'); setToken(null); setUser(null); };
  return <AuthContext.Provider value={{user,token,login,register,logout,loading}}>{children}</AuthContext.Provider>
};
export const useAuth=()=> useContext(AuthContext);
