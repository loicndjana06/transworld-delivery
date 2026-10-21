// Illustrative corridor via the Cape. It is not a navigational chart or a carrier schedule.
export type RoutePoint={name:string;lat:number;lng:number};
export type RouteConfig={name:string;mode:string;points:RoutePoint[]};
export const chinaConakry:RouteConfig={name:'Chine → Conakry · via le cap (indicatif)',mode:'Maritime',points:[
 {name:'Au large de Ningbo-Zhoushan',lat:29.7,lng:123.2},
 {name:'Mer de Chine méridionale',lat:15,lng:114},
 {name:'Approche orientale de Singapour',lat:1.3,lng:104.6},
 {name:'Détroit de Malacca',lat:4.8,lng:99.2},
 {name:'Océan Indien',lat:-10,lng:77},
 {name:'Au sud de Madagascar',lat:-28,lng:49},
 {name:'Au large du cap des Aiguilles',lat:-36,lng:20},
 {name:'Au large de Walvis Bay',lat:-23,lng:13.5},
 {name:'Atlantique · au large du Liberia',lat:3.5,lng:-12.8},
 {name:'Approche maritime de Conakry',lat:9.35,lng:-13.95}
]};
// Extra vertices prevent the ten simplified milestones being joined across land.
export const capeCorridor:[number,number][]=[
[29.7,123.2],[26,122],[25.5,121.5],[25,120],[23,118.5],[20,117],[15,114],[10,110],[6,106.5],[3,105.2],[1.3,104.6],[1.18,104.1],[1.17,103.85],[1.25,103.5],[1.6,103],[2.4,102],[3.3,101],[4.8,99.2],[6.2,97.5],[6.2,94],[5.5,90],[3,85],[-10,77],[-18,65],[-28,49],[-32,38],[-35,28],[-36,20],[-35,16],[-32,14],[-28,13],[-23,13.5],[-15,10],[-5,6],[0,0],[3.5,-12.8],[6,-14.5],[8,-14.5],[9.35,-13.95]];
export function validateRoute(raw:any):RouteConfig{
 if(!raw||typeof raw.name!=='string'||!raw.name.trim()||!['Maritime','Aérien','Terrestre','Combiné'].includes(raw.mode)||!Array.isArray(raw.points)||raw.points.length<2||raw.points.length>100)throw new Error('Parcours : nom, mode et 2 à 100 repères requis.');
 return {name:raw.name.trim().slice(0,200),mode:raw.mode,points:raw.points.map((p:any)=>{if(!p||typeof p.name!=='string'||!p.name.trim()||p.lat==null||p.lat===''||p.lng==null||p.lng===''||!Number.isFinite(Number(p.lat))||Math.abs(Number(p.lat))>90||!Number.isFinite(Number(p.lng))||Math.abs(Number(p.lng))>180)throw new Error('Chaque repère exige un nom et des coordonnées valides.');return {name:p.name.trim().slice(0,200),lat:Number(p.lat),lng:Number(p.lng)};})};
}
export function routeGeometry(route?:RouteConfig):[number,number][]{if(!route)return [];return JSON.stringify(route.points)===JSON.stringify(chinaConakry.points)?capeCorridor:route.points.map(p=>[p.lat,p.lng]);}
export function bearing(a:{lat:number;lng:number},b:{lat:number;lng:number}){const d=Math.PI/180,x=Math.sin((b.lng-a.lng)*d)*Math.cos(b.lat*d),y=Math.cos(a.lat*d)*Math.sin(b.lat*d)-Math.sin(a.lat*d)*Math.cos(b.lat*d)*Math.cos((b.lng-a.lng)*d);return (Math.atan2(x,y)/d+360)%360;}
