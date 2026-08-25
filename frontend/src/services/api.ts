import axios from 'axios';
const baseURL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4001';
const api = axios.create({ baseURL, headers: { 'Content-Type':'application/json' } });
api.interceptors.request.use(cfg=>{
  const token=localStorage.getItem('token');
  if(token) (cfg.headers as any).Authorization=`Bearer ${token}`;
  return cfg;
});
export default api;
