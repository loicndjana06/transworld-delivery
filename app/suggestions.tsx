'use client';
import {createContext,useContext,useEffect,useState} from 'react';
const Suggestions=createContext<Record<string,string[]>>({});
export function AdminSuggestions({children}:{children:React.ReactNode}){const [values,setValues]=useState<Record<string,string[]>>({});useEffect(()=>{let active=true;fetch('/api/suggestions',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(v=>{if(active)setValues(v);}).catch(()=>{});return()=>{active=false;};},[]);return <Suggestions.Provider value={values}>{children}</Suggestions.Provider>;}
export function SuggestedInput({name,...props}:any){const values=useContext(Suggestions),id='suggest-'+name;return <><input {...props} name={name} list={values[name]?.length?id:props.list}/>{!!values[name]?.length&&<datalist id={id}>{values[name].map(v=><option key={v} value={v}/>)}</datalist>}</>;}
