import {getSupabaseAdminClient} from './supabase';
export async function hashString(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function uploadToStorage(key: string, bytes: Uint8Array, contentType: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');

  const { error } = await supabase.storage
    .from('cargo-documents')
    .upload(key, bytes, {
      contentType,
      upsert: false,
    });

  if (error) throw new Error('Erreur de stockage : ' + error.message);
}

export async function getFromStorage(key: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');

  const { data, error } = await supabase.storage
    .from('cargo-documents')
    .download(key);

  if (error || !data) return null;
  const arrayBuffer = await data.arrayBuffer();
  return {
    body: new Uint8Array(arrayBuffer),
    mime: data.type || 'application/octet-stream',
  };
}

export async function deleteFromStorage(key: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  const {error} = await supabase.storage.from('cargo-documents').remove([key]);
  if(error) throw new Error('Suppression du fichier impossible.');
}

export async function createPrivateUploadUrl(key:string){
 const client=getSupabaseAdminClient();if(!client)throw new Error('Supabase non configuré.');
 const {data,error}=await client.storage.from('cargo-documents').createSignedUploadUrl(key,{upsert:false});
 if(error||!data)throw new Error('Autorisation d’import indisponible. Vérifiez le bucket privé cargo-documents.');
 return data;
}
export async function createPrivateDownloadUrl(key:string,name:string){
 const client=getSupabaseAdminClient();if(!client)throw new Error('Supabase non configuré.');
 const {data,error}=await client.storage.from('cargo-documents').createSignedUrl(key,60,{download:name});
 if(error||!data)throw new Error('Document indisponible dans le stockage.');
 return data.signedUrl;
}
export async function checkPrivateBucket(){
 const client=getSupabaseAdminClient();if(!client)throw new Error('Supabase non configuré.');
 const {data,error}=await client.storage.getBucket('cargo-documents');
 if(error||!data)throw new Error('Bucket cargo-documents absent ou inaccessible.');
 if(data.public)throw new Error('Le bucket cargo-documents doit être privé.');
 return {private:true,name:data.name};
}

