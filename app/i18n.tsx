'use client';
import {useEffect,useState} from 'react';
import dictionary from './i18n-data.json';
export type Locale='fr'|'en'|'ar';
export function tr(value:string){const locale=typeof document==='undefined'?'fr':document.documentElement.lang;return locale==='fr'?value:(dictionary as Record<string,string[]>)[value]?.[locale==='ar'?1:0]||value;}
export function LocaleSwitch(){const[locale,setLocale]=useState<Locale>('fr');useEffect(()=>{try{const saved=localStorage.getItem('transworld-locale');if(saved==='en'||saved==='ar')select(saved);}catch{}},[]);function select(next:Locale){setLocale(next);document.documentElement.lang=next;document.documentElement.dir=next==='ar'?'rtl':'ltr';try{localStorage.setItem('transworld-locale',next);}catch{}window.dispatchEvent(new Event('transworld-locale'));}return <label className="locale-switch"><span className="sr-only">Language / Langue / اللغة</span><select value={locale} aria-label="Language / Langue / اللغة" onChange={e=>select(e.target.value as Locale)}><option value="fr">FR</option><option value="en">EN</option><option value="ar">العربية</option></select></label>;}
