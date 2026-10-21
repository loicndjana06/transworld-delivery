import {getDetails} from './business';
export async function billingAssets(db:any,bucket:any,shipmentId:string){
 const extra=await getDetails(db,shipmentId);if(!extra.platformLogoDocument||!bucket)return {};
 const d:any=await db.prepare('SELECT key,mime,size FROM documents WHERE id=? AND shipment_id=? AND shared=1').bind(extra.platformLogoDocument,shipmentId).first();if(!d||!['image/jpeg','image/png'].includes(d.mime)||d.size>2*1024*1024)return {};
 const f=await bucket.get(d.key);if(!f)return {};const bytes=new Uint8Array(f.arrayBuffer?await f.arrayBuffer():f.body);return bytes.byteLength<=2*1024*1024?{logo:{mime:d.mime,bytes}}:{};
}
