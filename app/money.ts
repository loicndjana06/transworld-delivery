export type Money={amount:string,currency:string};
export const currencyCodes=typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('currency'):['USD','EUR','GBP','GNF','XAF','XOF','CNY','AED','CAD','NGN','GHS','MAD','JPY','CHF'];
const names=new Intl.DisplayNames(['fr'],{type:'currency'});
export const currencyName=(c:string)=>names.of(c)||c;
export function parseMoney(amount:unknown,currency:unknown,required=false):Money|null{
 if(amount===''||amount==null){if(required)throw new Error('Renseignez le montant.');return null;}
 const raw=String(amount).trim().replace(/\s/g,'').replace(',','.');
 const code=String(currency||'').trim().toUpperCase();
 if(!currencyCodes.includes(code))throw new Error('Choisissez une devise valide.');
 if(!/^\d{1,15}(?:\.\d{1,3})?$/.test(raw)||!Number.isFinite(Number(raw))||Number(raw)>Number.MAX_SAFE_INTEGER/1000||(required&&Number(raw)<=0))throw new Error('Montant invalide : utilisez un nombre positif, avec trois décimales maximum et jusqu’à 9 007 milliards.');
 return {amount:raw,currency:code};
}
export function formatMoney(m:Money){return new Intl.NumberFormat('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:3}).format(Number(m.amount))+' '+m.currency;}
export function invoiceMoney(i:any):Money|null{if(i.displayMoney)return i.displayMoney;try{return JSON.parse(i.metadata||'{}').displayMoney||null;}catch{return null;}}
export function invoiceAmount(i:any){const m=invoiceMoney(i);return m?formatMoney(m):Number(i.usd).toFixed(2)+' USD · '+Math.round(Number(i.gnf)).toLocaleString('fr-FR')+' GNF';}
