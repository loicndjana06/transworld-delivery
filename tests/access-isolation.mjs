import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';

const database=new DatabaseSync(':memory:');
database.exec('PRAGMA foreign_keys=ON');
for(const f of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort()) {
  database.exec(readFileSync('drizzle/'+f,'utf8'));
}

class Statement {
  constructor(sql,args=[]){this.sql=sql;this.args=args;}
  bind(...a){return new Statement(this.sql,a);}
  async first(){return database.prepare(this.sql).get(...this.args)||null;}
  async all(){return{results:database.prepare(this.sql).all(...this.args),meta:{changes:0}};}
  async run(){const r=database.prepare(this.sql).run(...this.args);return{meta:{changes:Number(r.changes)},results:[]};}
}

const files=new Map();
globalThis.__testEnv={
  ADMIN_TEST_PASSWORD:'isolation-test-password',
  DB:{
    prepare:sql=>new Statement(sql),
    batch:async qs=>{
      database.exec('BEGIN');
      try{
        const r=[];
        for(const q of qs)r.push(await q.run());
        database.exec('COMMIT');
        return r;
      }catch(e){
        database.exec('ROLLBACK');
        throw e;
      }
    }
  },
  BUCKET:{
    put:async(k,b)=>files.set(k,b),
    get:async k=>files.has(k)?{body:files.get(k)}:null,
    delete:async k=>files.delete(k)
  }
};

globalThis.__testUser={userId:'admin-operator',email:'admin@example.test',displayName:'Admin'};

await esbuild.build({
  entryPoints:['app/api/[...path]/route.ts'],
  outfile:'.sites-runtime/isolation-test.mjs',
  bundle:true,
  format:'esm',
  platform:'node',
  plugins:[{
    name:'mock-platform',
    setup(build){
      build.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'stub'}));
      build.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'stub'}));
      build.onLoad({filter:/.*/,namespace:'stub'},a=>({
        contents:a.path==='env'?'export const env=globalThis.__testEnv':'export async function getChatGPTUser(){return globalThis.__testUser}',
        loader:'js'
      }));
    }
  }]
});

const api=await import('../.sites-runtime/isolation-test.mjs');
const cookies=new Map();

async function call(path,body,user='admin-operator',origin='https://cargo.test'){
  globalThis.__testUser=user?{userId:user,email:user+'@example.test',displayName:user}:null;
  const form=body instanceof FormData;
  const req=new Request('https://cargo.test/api/'+path,{
    method:body?'POST':'GET',
    headers:body?{origin,cookie:cookies.get(user)||'',...(!form?{'Content-Type':'application/json'}:{})}:{cookie:cookies.get(user)||''},
    body:body?(form?body:JSON.stringify(body)):undefined
  });
  const res=await(body?api.POST(req):api.GET(req));
  const cookie=res.headers.get('set-cookie');
  if(cookie)cookies.set(user,cookie.split(';')[0]);
  let data;
  if(res.headers.get('content-type')?.includes('application/json'))data=await res.json();
  else data=new Uint8Array(await res.arrayBuffer());
  return{status:res.status,data,headers:res.headers};
}

console.log('--- DÉMARRAGE DU TEST D\'ISOLATION ET DE SÉCURITÉ ---');

// 1. Authentification admin
const loginRes = await call('admin-login',{password:'isolation-test-password'},'admin-operator');
assert.equal(loginRes.status,200,'Connexion admin valide');
console.log('✓ 1. Connexion admin réussie et session sécurisée établie.');

// 2. Création d'un dossier avec données sensibles et note interne confidentielle
const shipmentData={
  client:'Client Confidentiel SARL',
  contact:'+237 600 00 00 00',
  email:'contact@confidentiel.test',
  item:'Toyota Land Cruiser 2024',
  category:'Véhicule',
  origin:'Anvers',
  destination:'Douala',
  container:'MSCU-987654-2',
  vehicleBase:12000000,
  vehicleUsdRate:0.0017,
  vehicleGnfRate:8600,
  purchaseReference:'ACHAT-SECRET-999',
  firstInvoiceReference:'FAC-INT-001'
};
const created=await call('shipments',shipmentData,'admin-operator');
assert.equal(created.status,201,'Création de dossier par l\'administrateur');
const {id:shipmentId,ref,access}=created.data;
console.log('✓ 2. Dossier créé avec succès (Réf: '+ref+').');

// 3. Ajout d'une étape confirmée avec note interne privée
const eventData={
  type:'En transport',
  place:'Port d\'Anvers (Quai 420)',
  date:'2026-10-10T10:00:00Z',
  source:'Agent maritime Anvers',
  note:'NOTE INTERNE CONFIDENTIELLE : Contrôle douane spécial réussi, documents originaux dans le coffre A-3',
  version:0,
  published:true,
  lat:51.2194,
  lng:4.4025,
  mode:'Maritime'
};
const evRes=await call('shipments/'+shipmentId+'/events',eventData,'admin-operator');
assert.equal(evRes.status,200,'Ajout d\'étape confirmée');
console.log('✓ 3. Étape maritime avec note interne ajoutée et publiée.');

// 4. Test d'étanchéité : Suivi ANONYME (consultation par la référence publique uniquement)
const anonTracking=(await call('tracking?ref='+ref,undefined,null)).data;
assert.equal(anonTracking.privateAccess,false,'Accès anonyme confirmé sans privilège privé');
assert.equal(anonTracking.shipment.client,undefined,'Nom client masqué à l\'anonyme');
assert.equal(anonTracking.shipment.item,undefined,'Description marchandise masquée');
assert.equal(anonTracking.shipment.orderUsd,undefined,'Montant USD masqué');
assert.equal(anonTracking.shipment.orderGnf,undefined,'Montant GNF masqué');
assert.equal(anonTracking.shipment.container,undefined,'Conteneur masqué');
assert.equal(anonTracking.documents.length,0,'Documents privés masqués à l\'anonyme');
assert.equal(anonTracking.notices.length,0,'Notifications privées masquées à l\'anonyme');
assert.equal(anonTracking.invoices.length,0,'Factures privées masquées à l\'anonyme');

// Vérification cruciale : la note interne en texte libre DOIT être absente de la réponse anonyme
assert.ok(anonTracking.events.length>0,'L\'étape publique est bien listée');
assert.equal(anonTracking.events[0].note,'','Note interne confidentielle strictement masquée dans le suivi anonyme');
console.log('✓ 4. Isolation du suivi anonyme validée : informations client, financières et note interne strictement purgées.');

// 5. Test du lien privé autorisé (Dossier-authorized client update)
const authorizedTracking=(await call('tracking?ref='+ref+'&access='+access,undefined,null)).data;
assert.equal(authorizedTracking.privateAccess,true,'Accès privé reconnu via le jeton autorisé');
assert.equal(authorizedTracking.shipment.client,'Client Confidentiel SARL','Client accessible via lien privé');
assert.equal(authorizedTracking.shipment.item,'Toyota Land Cruiser 2024','Marchandise accessible via lien privé');
assert.equal(authorizedTracking.events[0].note,eventData.note,'Note accessible pour le client autorisé');
console.log('✓ 5. Lien privé autorisé validé : le client accède légitimement à ses informations.');

// 6. Test d'invalidation : Tentative avec faux jeton d'accès ou jeton corrompu
const forgedTracking=(await call('tracking?ref='+ref+'&access=invalid_forged_token_123',undefined,null)).data;
assert.equal(forgedTracking.privateAccess,false,'Faux jeton rejeté');
assert.equal(forgedTracking.shipment.client,undefined,'Faux jeton ne donne aucun accès client');
assert.equal(forgedTracking.events[0].note,'','Faux jeton ne donne aucune note interne');
console.log('✓ 6. Tentative de falsification de jeton d\'accès déjouée (rétrogradation en accès anonyme expurgé).');

// 7. Isolation inter-administrateurs / opérateurs
// Sans session valide : 401 Unauthorized
const noSessionRes=await call('shipments',undefined,null);
assert.equal(noSessionRes.status,401,'Accès sans session admin refusé avec 401');

// Avec une session d'un autre opérateur : les dossiers sont strictement isolés par propriétaire
await call('admin-login',{password:'isolation-test-password'},'operator-b');
const operatorBList=await call('shipments',undefined,'operator-b');
assert.equal(operatorBList.data.length,0,'Un autre opérateur voit 0 dossier du premier');
const unauthDetail=await call('shipments/'+shipmentId,undefined,'operator-b');
assert.equal(unauthDetail.status,403,'Un autre opérateur est bloqué avec 403 Forbidden sur le dossier d\'autrui');
console.log('✓ 7. Isolation inter-comptes validée : 401 pour anonymes et 403 / liste vide pour les tiers.');

// 8. Vérification de la configuration de cartographie OpenStreetMap canonique
const configRes=(await call('config?ref='+ref,undefined,null)).data;
assert.equal(configRes.tileUrl,'https://tile.openstreetmap.org/{z}/{x}/{y}.png','URL de tuiles OSM canonique sans sous-domaine cyclique');
assert.ok(configRes.attribution.includes('OpenStreetMap'),'Attribution OpenStreetMap conforme');
console.log('✓ 8. Configuration Leaflet/OpenStreetMap vérifiée : URL canonique https://tile.openstreetmap.org/{z}/{x}/{y}.png.');

console.log('--- TOUS LES TESTS D\'ISOLATION ET D\'ACCÈS ONT RÉUSSI (8/8) ---');
