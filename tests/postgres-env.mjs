import {PGlite} from '@electric-sql/pglite';
import {readFileSync,mkdirSync} from 'node:fs';
import esbuild from 'esbuild';
process.env.NODE_ENV='test';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://unit.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='public-test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY='server-test-key';
export const pg=new PGlite();
await pg.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage; create table auth.users(id uuid primary key); create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; create publication supabase_realtime;");
await pg.exec("create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$; grant usage on schema auth,storage to anon,authenticated,service_role; grant execute on all functions in schema auth to anon,authenticated,service_role; grant all on storage.objects,storage.buckets to service_role; grant select,insert,update,delete on storage.objects to authenticated;");
await pg.exec("insert into auth.users(id) values ('1d932391-a77a-4527-9b6d-1d7d4e884b4e');");
let schema=readFileSync('integrations/supabase/schema.sql','utf8').replace('create extension if not exists "pgcrypto";','');
await pg.exec(schema);
await pg.exec(readFileSync('integrations/supabase/migrations/05_server_transactions.sql','utf8'));
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const url=String(input);
 if(url==='https://unit.supabase.co/rest/v1/rpc/cargo_execute'){
  try{
   const {statements}=JSON.parse(init.body);
   await pg.exec('set role service_role');
   const result=await pg.query('select public.cargo_execute($1::jsonb) as data',[JSON.stringify(statements)]);
   await pg.exec('reset role');
   return Response.json(result.rows[0].data);
  }catch(e){await pg.exec('reset role');return Response.json({message:e.message,code:e.code},{status:400});}
 }
 if(url.startsWith('https://api.resend.com')) throw new Error('Email external calls disabled in tests');
 return nativeFetch(input,init);
};
mkdirSync('.sites-runtime',{recursive:true});
await esbuild.build({entryPoints:['lib/database.ts'],outfile:'.sites-runtime/pg-adapter.mjs',bundle:true,platform:'node',format:'esm'});
const {database:adapter,postgresStatement}=await import('../.sites-runtime/pg-adapter.mjs');
export const testDb=adapter;
export class Statement{
 constructor(sql,args=[]){this.sql=sql;this.args=args;}
 bind(...a){return new Statement(this.sql,a);}
 first(){return adapter.prepare(this.sql).bind(...this.args).first();}
 all(){return adapter.prepare(this.sql).bind(...this.args).all();}
 run(){return adapter.prepare(this.sql).bind(...this.args).run();}
}
export const database={
 prepare:sql=>({get:async(...args)=>adapter.prepare(sql).bind(...args).first()}),
 exec:sql=>pg.exec(sql)
};
export {postgresStatement};
