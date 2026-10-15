import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import {pg,testDb,postgresStatement} from './postgres-env.mjs';
const uid='1d932391-a77a-4527-9b6d-1d7d4e884b4e';
globalThis.__testEnv={DB:testDb,ADMIN_TEST_PASSWORD:'isolated-password-2026',ADMIN_USER_ID:uid};
delete globalThis.__testUser;
globalThis.__requestCookie='';
await esbuild.build({
 stdin:{contents:"export {GET,POST} from './app/api/[...path]/route';export {getAdminUser} from './lib/auth';",resolveDir:process.cwd(),loader:'ts'},
 outfile:'.sites-runtime/security-api.mjs',bundle:true,platform:'node',format:'esm',
 plugins:[{name:'request-cookie',setup(b){b.onResolve({filter:/^next\/headers$/},()=>({path:'cookie',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:"export async function cookies(){return {get(name){const v=(globalThis.__requestCookie||'').match(/(?:^|;\\s*)kc_admin=([a-f0-9]{48})/);return v?{value:v[1]}:undefined;}}}",loader:'js'}));}}]
});
const api=await import('../.sites-runtime/security-api.mjs');
async function call(path,body){
 const headers={cookie:globalThis.__requestCookie};
 if(body){headers.origin='https://cargo.test';headers['Content-Type']='application/json';}
 const response=await (body?api.POST:api.GET)(new Request('https://cargo.test/api/'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}));
 return {response,data:await response.json()};
}
assert.equal(await api.getAdminUser(),null);
assert.equal((await call('admin-login',{password:'wrong'})).response.status,403);
const login=await call('admin-login',{password:'isolated-password-2026'});
assert.equal(login.response.status,200);
assert.match(login.response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=None; Partitioned/);
globalThis.__requestCookie=login.response.headers.get('set-cookie').split(';')[0];
assert.equal((await api.getAdminUser()).userId,uid,'Real cookie resolves the sole configured UUID');
assert.equal((await call('shipments')).response.status,200);
assert.equal((await call('shipments/anything/link')).response.status,405,'GET cannot renew a private link');
const privateText="Client ' ; DROP TABLE shipments; -- \\ valeur";
const created=await call('shipments',{client:privateText,contact:'client@example.test',item:'Véhicule réel déclaré',category:'Véhicule',origin:'Dubaï',destination:'Conakry',purchaseReference:'EXTERNAL',firstInvoiceReference:'INVOICE'});
assert.equal(created.response.status,201,JSON.stringify(created.data));
assert.equal((await testDb.prepare('select client from shipments where id=?').bind(created.data.id).first()).client,privateText);
const before=await testDb.prepare('select count(*) as n from audit').first();
await assert.rejects(testDb.batch([
 testDb.prepare('insert into audit(id,owner,action,created) values (?,?,?,?)').bind('rollback-check',uid,'test',new Date().toISOString()),
 testDb.prepare('insert into shipments(id) values (?)').bind('invalid')
]));
assert.equal((await testDb.prepare('select count(*) as n from audit').first()).n,before.n,'Failed batch rolls back every write');
for(const role of ['anon','authenticated']) {
 await pg.exec('set role '+role);
 assert.equal((await pg.query("select has_function_privilege(current_user,'public.cargo_execute(jsonb)','EXECUTE') as allowed")).rows[0].allowed,false);
 if(role==='anon')await assert.rejects(pg.query('select * from public.shipments'));
 else assert.equal((await pg.query('select * from public.shipments')).rows.length,0);
 await pg.exec('reset role');
}
await pg.exec("set role authenticated; select set_config('request.jwt.claim.sub','"+uid+"',false);");
assert.ok((await pg.query('select * from public.shipments')).rows.length>0);
await pg.exec("reset role; select set_config('request.jwt.claim.sub','',false);");
await pg.exec("set role anon;");
const tracking=(await pg.query('select public.get_public_tracking($1) as data',[created.data.ref])).rows[0].data;
assert.equal(tracking.shipment.client,undefined);assert.equal(tracking.shipment.token_hash,undefined);
await pg.exec('reset role');
for(let i=1;i<=9;i++){
 const allowed=(await pg.query("select public.cargo_throttle('unit-login',8) as allowed")).rows[0].allowed;
 assert.equal(allowed,i<=8);
}
await call('admin-logout',{});
assert.equal(await api.getAdminUser(),null,'Logout invalidates the old cookie');
delete globalThis.__testEnv.ADMIN_TEST_PASSWORD;
assert.equal((await call('admin-login',{password:'anything'})).response.status,503,'No default admin password');
assert.equal((await call('status')).data.configured,false);
console.log('PASS — PostgreSQL: real hashed cookie session, sole admin UUID, SQL escaping, atomic rollback, RLS isolation, anonymous RPC, throttling and logout.');
await pg.close();
