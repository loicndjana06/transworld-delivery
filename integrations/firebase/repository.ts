import {initializeApp,type FirebaseOptions} from 'firebase/app';
import {getAuth,signInWithEmailAndPassword} from 'firebase/auth';
import {getFirestore,doc,collection,onSnapshot,getDocs,query,where,writeBatch,serverTimestamp} from 'firebase/firestore';
import {getStorage,ref,uploadBytes,getBlob} from 'firebase/storage';
// Adaptateur exportable. Il n'est pas activé dans l'hébergement actuel.
export function connectFirebase(options:FirebaseOptions){if(!options.projectId||!options.apiKey)throw new Error('Configuration Firebase incomplète');const app=initializeApp(options,'krea-cargo-external');return {auth:getAuth(app),db:getFirestore(app),storage:getStorage(app)};}
export function firebaseRepository(options:FirebaseOptions,agencyId:string){const services=connectFirebase(options),{db,auth,storage}=services;
 return {
  signIn:(email:string,password:string)=>signInWithEmailAndPassword(auth,email,password),
  subscribePublicTracking:(reference:string,next:(data:unknown)=>void,error:(e:Error)=>void)=>onSnapshot(doc(db,'publicTracking',reference),snap=>next(snap.exists()?snap.data():null),error),
  subscribePrivateShipment:(id:string,next:(data:unknown)=>void,error:(e:Error)=>void)=>onSnapshot(doc(db,'shipments',id),snap=>next(snap.exists()?snap.data():null),error),
  async listShipments(){const r=await getDocs(query(collection(db,'shipments'),where('agencyId','==',agencyId)));return r.docs.map(s=>({id:s.id,...s.data()}));},
  async saveShipment(id:string,data:Record<string,unknown>,publicView:Record<string,unknown>){if(!auth.currentUser)throw new Error('Connexion nécessaire');const reference=String(publicView.ref||'');if(!reference.startsWith('KC-'))throw new Error('Référence invalide');const batch=writeBatch(db);batch.set(doc(db,'shipments',id),{...data,agencyId,updated:serverTimestamp()},{merge:true});batch.set(doc(db,'publicTracking',reference),{ref:reference,agencyId,origin:publicView.origin,destination:publicView.destination,status:publicView.status,eta:publicView.eta||'',events:publicView.events||[],updated:serverTimestamp()});await batch.commit();},
  downloadDocument:(key:string)=>getBlob(ref(storage,key)),
  async uploadDocument(shipmentId:string,file:File){if(!auth.currentUser)throw new Error('Connexion nécessaire');if(file.size>10*1024*1024)throw new Error('Fichier trop volumineux');const key=`agencies/${agencyId}/shipments/${shipmentId}/${crypto.randomUUID()}`;const target=ref(storage,key);await uploadBytes(target,file,{contentType:file.type});return {key};},
 };
}
