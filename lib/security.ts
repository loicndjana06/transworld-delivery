import {getSupabaseAdminClient} from './supabase';
import {hashString} from './supabase-service';
export async function allowAttempt(req:Request, purpose:string, limit:number) {
  if(process.env.NODE_ENV==='test' && (globalThis as any).__testEnv?.DB) return true;
  const client=getSupabaseAdminClient();
  if(!client) throw new Error('Configuration Supabase manquante.');
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const {data,error}=await client.rpc('cargo_throttle',{p_key:purpose+':'+await hashString(ip),p_limit:limit});
  if(error) throw new Error('Exécutez la migration 05_server_transactions.sql dans Supabase SQL Editor.');
  return data===true;
}
