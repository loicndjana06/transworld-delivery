import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'TRANSWORLD DELIVERY | Chaque étape compte',description:'Votre expédition, du départ à l’arrivée. Suivi et gestion des dossiers de transport.',referrer:'no-referrer',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>;}
