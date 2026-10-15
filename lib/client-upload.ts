'use client';
export async function uploadPrivateFile(file:File,details:Record<string,unknown>){
 if(!file||!file.size||file.size>10*1024*1024)throw new Error('PDF, JPG ou PNG requis, 10 Mo maximum.');
 const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
 const sig=Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');
 const mime=sig.startsWith('25504446')?'application/pdf':sig.startsWith('ffd8ff')?'image/jpeg':sig.startsWith('89504e470d0a1a0a')?'image/png':'';
 if(!mime)throw new Error('Le contenu doit être un vrai PDF, JPG ou PNG.');
 const post=async(path:string,body:unknown)=>{
  const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const d=await r.json();if(!r.ok)throw new Error(d.error||'Import impossible.');return d;
 };
 const intent=await post('upload-intent',{...details,name:file.name,size:file.size,mime});
 const target=new URL(intent.url);
 if(target.protocol!=='https:')throw new Error('Adresse de stockage non sécurisée.');
 const sent=await fetch(target,{method:'PUT',headers:{'Content-Type':mime,'x-upsert':'false'},body:file});
 if(!sent.ok)throw new Error('Le stockage a refusé le fichier. Vérifiez votre connexion puis recommencez.');
 return post('upload-finalize',{id:intent.id,access:details.access||''});
}
