import {PDFDocument,rgb} from 'pdf-lib';
import {formatMoney} from './money';
import fontkit from '@pdf-lib/fontkit';
import {regular,bold as boldData} from './pdf-fonts';

// Generated from the current private dossier. Never creates an invoice or payment.
export async function proformaPdf(s:any){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const decode=(v:string)=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
 const font=await pdf.embedFont(decode(regular),{subset:true}),bold=await pdf.embedFont(decode(boldData),{subset:true});
 const ink=rgb(.045,.16,.19),teal=rgb(.07,.39,.45),gold=rgb(.70,.57,.33),pale=rgb(.95,.97,.97),muted=rgb(.35,.41,.43),white=rgb(1,1,1);
 const W=595,H=842,M=36,CW=W-2*M;let page=pdf.addPage([W,H]),y=H-36;
 const clean=(v:any)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
 const text=(v:string,x:number,top:number,size=10,strong=false,color=ink)=>page.drawText(v,{x,y:H-top-size,size,font:strong?bold:font,color});
 const lines=(v:any,width:number,size=10,strong=false)=>{const f=strong?bold:font,out:string[]=[];let line='';for(const word of clean(v).split(/\s+/)){const next=line?line+' '+word:word;if(f.widthOfTextAtSize(next,size)<=width){line=next;continue;}if(line){out.push(line);line='';}let chunk='';for(const ch of word){if(chunk&&f.widthOfTextAtSize(chunk+ch,size)>width){out.push(chunk);chunk='';}chunk+=ch;}line=chunk;}if(line)out.push(line);return out.length?out:['Non renseigné'];};
 // All blocks measure wrapped text before drawing; long client data continues on a new page.
 function header(){page.drawRectangle({x:0,y:H-103,width:W,height:103,color:ink});text('TD',M,26,21,true,white);text('TRANSWORLD DELIVERY',M+48,24,18,true,white);text('TRANSPORT & SUIVI INTERNATIONAL',M+49,51,8,false,white);text('PRO FORMA ACHAT',M,108,24,true);text('Récapitulatif du prix d’achat externe',M,140,11,false,muted);page.drawRectangle({x:M,y:H-163,width:CW,height:2,color:gold});y=167;}
 function ensure(height:number){if(y+height>H-55){page=pdf.addPage([W,H]);header();}}
 function section(label:string,body:string[]){const wrapped=body.flatMap(v=>lines(v,CW-24));let n=0;while(n<wrapped.length){ensure(55);const count=Math.max(1,Math.min(wrapped.length-n,Math.floor((H-65-y-30)/14)));page.drawRectangle({x:M,y:H-y-23,width:CW,height:23,color:teal});text(label+(n?' - suite':''),M+12,y+5,9,true,white);y+=28;for(const line of wrapped.slice(n,n+count)){text(line,M+12,y,10);y+=13;}n+=count;y+=8;}}
 header();
 const extra=s.extra||{},issuer=s.issuer||{};const generated=new Date().toISOString();
 section('RÉFÉRENCES DU DOCUMENT',[
  'Référence pro forma : PF-'+s.ref+' | Dossier : '+s.ref,
  'Générée le : '+new Date(generated).toLocaleString('fr-FR',{timeZone:'UTC'})+' UTC',
  'Référence achat externe : '+(extra.purchaseReference||'Non renseignée'),
  'Première facture d’achat : '+(extra.firstInvoiceReference||'Non renseignée')]);
 const left=[issuer.name||'TRANSWORLD DELIVERY',issuer.address||'Adresse entreprise à renseigner',[issuer.email,issuer.phone].filter(Boolean).join(' | ')||'Contacts entreprise à renseigner',...(issuer.registration?['Immatriculation : '+issuer.registration]:[])];
 const right=[s.client,'Téléphone / contact : '+(s.contact||'Non renseigné'),'Courriel : '+(s.email||'Non renseigné')];
 const lw=left.flatMap(v=>lines(v,(CW-18)/2-20,9)),rw=right.flatMap(v=>lines(v,(CW-18)/2-20,9));
 const bh=36+Math.max(lw.length,rw.length)*13;ensure(bh+10);
 [0,1].forEach(k=>{const x=M+k*((CW+18)/2),width=(CW-18)/2;page.drawRectangle({x,y:H-y-bh,width,height:bh,color:pale});text(k?'CLIENT / DESTINATAIRE':'AGENCE / SERVICE ÉMETTEUR',x+10,y+9,8,true,teal);(k?rw:lw).forEach((l,j)=>text(l,x+10,y+30+j*13,9));});y+=bh+10;
 section('MARCHANDISE & REMISE SOUHAITÉE',[
  'Désignation : '+(s.item||'Non renseignée')+' | Catégorie : '+(s.category||'Non renseignée'),
  ...(extra.vin?['VIN : '+extra.vin]:[]),
  'Origine : '+s.origin+' | Destination : '+s.destination,
  'Remise : '+[extra.deliveryCountry,extra.deliveryCity,extra.deliveryType,extra.deliveryAddress||s.delivery].filter(Boolean).join(' / '),
  'Créneau souhaité : '+(extra.deliverySlot||'À convenir'),
  extra.destinationConfirmed?'Destination et service confirmés par l’agence.':'Destination, disponibilité du service et frais à confirmer par l’agence.'
 ]);
 const hasPrice=s.order_usd!=null&&s.order_gnf!=null&&Number.isFinite(Number(s.order_usd))&&Number.isFinite(Number(s.order_gnf));
 ensure(90);page.drawRectangle({x:M,y:H-y-24,width:CW,height:24,color:ink});text('DÉSIGNATION',M+12,y+6,9,true,white);text(extra.purchaseAmount?'MONTANT ET DEVISE':'MONTANT USD',W-210,y+6,9,true,white);if(!extra.purchaseAmount)text('ÉQUIVALENT GNF',W-125,y+6,8,true,white);y+=32;
 text('Prix du produit / véhicule seul',M+12,y,10,true);if(extra.purchaseAmount){const amount=formatMoney({amount:extra.purchaseAmount,currency:extra.purchaseCurrency});const amountLines=lines(amount,175,10,true);for(const [index,line] of amountLines.entries())text(line,W-210,y+index*13,10,true);y+=Math.max(27,amountLines.length*13+10);}else{text(hasPrice?Number(s.order_usd).toFixed(2):'À renseigner',W-210,y,10,true);text(hasPrice?Math.round(s.order_gnf).toLocaleString('fr-FR'):'À renseigner',W-125,y,10,true);y+=27;}
 text('Achat externe : montant de référence, sans appel de fonds de l’agence.',M+12,y,9,false,muted);y+=23;
 section('CONVERSION & PRESTATIONS EXCLUES',[
  extra.purchaseAmount?'Montant libre dans la devise choisie, sans conversion automatique.':'Source des taux : '+(extra.rateSource||'À renseigner')+' | Date des taux : '+(extra.rateDate||'À renseigner'),
  'Transport, transit, formalités, droits et taxes, stockage et livraison finale exclus de ce montant. Ces prestations seront expliquées et facturées séparément selon les besoins réels du dossier.',
  'Toute prestation ultérieure précise son motif, son prestataire, ses justificatifs et ses instructions de paiement. Aucun tarif de destination n’est présumé.'
 ]);
 section('PORTÉE & VALIDATION',[
  'Pro forma indicative générée depuis les informations actuelles du dossier. Elle ne remplace ni la facture du vendeur externe, ni une facture de prestation, ni un Bill of Lading ou une AWB.',
  'Ce document ne confirme aucun paiement, réception, réservation de transport ou départ. Les mises à jour du suivi reposent sur des confirmations réelles.',
  'Service émetteur : '+(issuer.department||'Opérations')+' | Responsable habilité : à compléter.',
  'Signature / cachet authentiques : à apposer uniquement après validation.'
 ]);
 const pages=pdf.getPages();pages.forEach((p,index)=>{p.drawLine({start:{x:M,y:35},end:{x:W-M,y:35},color:gold,thickness:1});p.drawText('TRANSWORLD DELIVERY | PF-'+s.ref+' | '+(index+1)+' / '+pages.length,{x:M,y:21,font,size:8,color:muted});});
 pdf.setTitle('Pro forma achat - '+s.ref);pdf.setSubject('Prix d’achat externe uniquement - transport et prestations exclus');return pdf.save();
}
