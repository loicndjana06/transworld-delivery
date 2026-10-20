'use client';
import {SuggestedInput} from './suggestions';
import {useState} from 'react';
import {uploadPrivateFile} from '@/lib/client-upload';
export const partnerKeys=['sellerName','sellerAddress','sellerContact','sellerRegistration','sellerRole','clientInformation','orderSigner','orderSignedAt','transportMode','sellerLogoDocument','platformLogoDocument','productPhotoDocument','signatureDocument'];
export const assetFields=[['sellerLogoDocument','Logo du vendeur'],['platformLogoDocument','Logo du service de suivi'],['productPhotoDocument','Photo de la marchandise'],['signatureDocument','Signature authentique autorisée']] as const;
export function PartnerFields({data={},documents=[]}:{data?:any,documents?:any[]}){
 const [mode,setMode]=useState(data.transportMode||'');
 return <fieldset style={{border:'1px solid #d7e2e3',borderRadius:12,padding:18,margin:'18px 0'}}><legend>Vendeur, marchandise et présentation client</legend><p className="tiny muted">Le vendeur reste distinct du service de suivi. Ces informations seront visibles dans le dossier privé et le bon de commande.</p>
 {([['sellerName','Entreprise vendeuse'],['sellerAddress','Adresse du vendeur'],['sellerContact','Contact du vendeur'],['sellerRegistration','Immatriculation du vendeur (si vérifiée)']] as const).map(([name,label])=><label key={name}>{label}<SuggestedInput name={name} defaultValue={data[name]||''} maxLength={500}/></label>)}
 <label>Rôle de l’entreprise partenaire<select name="sellerRole" defaultValue={data.sellerRole||'Vendeur'}>{['Vendeur','Vendeur et expéditeur','Expéditeur mandaté'].map(v=><option key={v}>{v}</option>)}</select></label>
 <label>Transport principal<select name="transportMode" value={mode} onChange={e=>setMode(e.target.value)}><option value="">À confirmer</option>{['Maritime','Aérien','Terrestre','Combiné'].map(v=><option key={v}>{v}</option>)}</select></label>
 <p className="tiny muted">{mode==='Maritime'?'Parcours : préparation, port de départ, embarquement, traversée, arrivée, formalités et remise.':mode==='Aérien'?'Parcours : préparation, aéroport de départ, vol, arrivée, formalités et remise.':mode==='Terrestre'?'Parcours : enlèvement, départ, points de passage, arrivée et remise.':'Les segments et étapes réels restent gérés par l’administrateur.'} Le choix du mode ne confirme aucun déplacement.</p>
 <label>Information utile pour le client<textarea name="clientInformation" defaultValue={data.clientInformation||''} maxLength={1500} rows={3}/></label>
 {assetFields.map(([name,label])=><div key={name} style={{marginTop:14}}><label>{label}<select name={name} defaultValue={data[name]||''}><option value="">Sans image</option>{documents.filter(d=>d.shared&&['image/jpeg','image/png'].includes(d.mime)&&d.size<=2*1024*1024).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Ou importer une nouvelle image<input name={name+'File'} type="file" accept="image/jpeg,image/png"/></label></div>)}
 <p className="tiny muted">JPG ou PNG, 2 Mo maximum par image. Les images importées ici sont partagées uniquement dans ce dossier privé. Pour une signature, utilisez exclusivement un fichier fourni avec l’autorisation du signataire.</p>
 <label>Nom du signataire habilité<input name="orderSigner" defaultValue={data.orderSigner||''} maxLength={200}/></label><label>Date réelle de signature<input name="orderSignedAt" type="date" defaultValue={data.orderSignedAt||''}/></label>
 </fieldset>;
}
export async function collectPartnerFields(form:FormData,shipmentId:string){
 const data:any={};for(const key of partnerKeys)if(form.has(key))data[key]=String(form.get(key)||'');
 for(const [key,label] of assetFields){const file=form.get(key+'File');if(file instanceof File&&file.size){if(file.size>2*1024*1024)throw new Error(label+' : 2 Mo maximum.');const sig=Array.from(new Uint8Array(await file.slice(0,8).arrayBuffer())).map(x=>x.toString(16).padStart(2,'0')).join('');if(!sig.startsWith('ffd8ff')&&!sig.startsWith('89504e470d0a1a0a'))throw new Error(label+' : JPG ou PNG requis.');const result=await uploadPrivateFile(file,{shipmentId,kind:'Autre',shared:true});data[key]=result.id;}}
 return data;
}
