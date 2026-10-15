'use client';
export default function ErrorPage({reset}:{reset:()=>void}){
 return <main className="wrap information-page"><p className="eyebrow">TRANSWORLD DELIVERY</p><h1>Cette page n’a pas pu s’ouvrir.</h1><p>Réessayez. Si le problème persiste, contactez l’agence avec le bouton d’assistance depuis l’accueil.</p><div className="information-actions"><button className="btn primary" onClick={reset}>Réessayer</button><a className="btn secondary" href="/">Retour à l’accueil</a></div></main>;
}
