'use client';
import {useEffect,useState} from 'react';
import {chinaConakry,type RouteConfig} from './maritime';
export default function LocationFields({route,onEstimate}:{route?:RouteConfig,onEstimate?:(v:boolean)=>void}){
 const [locations,setLocations]=useState<any[]>([]),[place,setPlace]=useState(''),[lat,setLat]=useState(''),[lng,setLng]=useState(''),[kind,setKind]=useState('confirmed');
 useEffect(()=>{fetch('/api/locations',{cache:'no-store'}).then(r=>r.ok?r.json():[]).then(setLocations).catch(()=>{});},[]);
 const points=(route||chinaConakry).points;
 function fill(p:any){setPlace(p.name||p.place);setLat(String(p.lat));setLng(String(p.lng));setKind('confirmed');onEstimate?.(false);}
 return <fieldset className="workflow-fieldset"><legend>Lieu et position sur la carte</legend>
 <label>Repères du parcours<select defaultValue="" onChange={e=>fill(points[Number(e.target.value)])}><option value="" disabled>Choisir un repère · {(route||chinaConakry).name}</option>{points.map((p,i)=><option key={i} value={i}>{i+1}. {p.name}</option>)}</select></label>
 <p className="tiny muted">Choisissez le repère correspondant à la position reçue du transporteur. La publication affichera cette position comme confirmée au client.</p>
 <label>Nature de la position<select name="positionKind" value={kind} onChange={e=>{setKind(e.target.value);onEstimate?.(e.target.value==='estimated');}}><option value="confirmed">Position confirmée par le transporteur (par défaut)</option><option value="estimated">Estimation facultative · à utiliser seulement si non confirmée</option></select></label>
 <label>Ou réutiliser un lieu enregistré<select defaultValue="" onChange={e=>{const p=locations[Number(e.target.value)];if(p)fill(p);}}><option value="" disabled>Choisir un lieu…</option>{locations.map((p,i)=><option key={i} value={i}>{p.place} · {p.lat}, {p.lng}</option>)}</select></label>
 <label>Nom du lieu<input name="place" required value={place} onChange={e=>setPlace(e.target.value)} placeholder="Port, aéroport, entrepôt ou zone maritime…"/></label><div className="form-grid"><label>Latitude<input name="lat" type="number" step="any" min={-90} max={90} value={lat} onChange={e=>setLat(e.target.value)}/></label><label>Longitude<input name="lng" type="number" step="any" min={-180} max={180} value={lng} onChange={e=>setLng(e.target.value)}/></label></div>
 </fieldset>;
}
