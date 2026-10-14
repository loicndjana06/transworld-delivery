export const stages=['Enregistré','Reçu par l’agence','En préparation','En transport','Arrivé à destination','Formalités en cours','Prêt à retirer','Livré'];
export const eventTypes=[...stages,'Escale','Transbordement','Retard','Information','Annulé','Retourné'];
export function statusFromEvents(events:any[]){const real=events.filter(e=>!e.planned&&e.published).sort((a,b)=>a.date.localeCompare(b.date)||a.created.localeCompare(b.created));let state='Enregistré';for(const e of real){if(['Annulé','Retourné'].includes(e.type))state=e.type;else if(stages.includes(e.type)&&!['Annulé','Retourné'].includes(state)&&stages.indexOf(e.type)>=stages.indexOf(state))state=e.type;}return state;}
export function validActualDate(date:string,planned:boolean){const t=Date.parse(date);return Number.isFinite(t)&&(planned||t<=Date.now()+60000);}
export function clean(v:unknown,max=400){return typeof v==='string'?v.trim().slice(0,max):'';}

export const countries=['Bénin','Burkina Faso','Côte d’Ivoire','Gambie','Ghana','Guinée','Guinée-Bissau','Liberia','Mali','Mauritanie','Niger','Nigeria','Sénégal','Sierra Leone','Togo','Cameroun','République centrafricaine','Tchad','République du Congo','République démocratique du Congo','Gabon','Guinée équatoriale','Angola','São Tomé-et-Príncipe'];
