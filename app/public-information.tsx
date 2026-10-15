'use client';
import {tr} from './i18n';
export const publicPages: Record<string,{title:string; intro:string; sections:[string,string][]}> = {
 about:{title:'À propos',intro:'TRANSWORLD DELIVERY centralise les informations de transport après votre achat : un dossier, une référence et un historique consultable.',
 sections:[['Notre rôle','Votre achat est réalisé auprès de votre vendeur. L’agence organise les prestations convenues et publie les informations reçues des intervenants du transport.'],
 ['Un suivi transparent','Les lieux et dates confirmés sont distincts des prévisions. La carte présente la dernière position renseignée par l’agence, avec sa date de mise à jour.'],
 ['Vos informations privées','La référence permet un suivi limité. Votre lien privé donne accès aux documents partagés, aux factures et aux informations personnelles de votre dossier.']]},
 services:{title:'Nos services',intro:'Le mode de transport et les prestations sont confirmés selon votre marchandise, votre destination et les possibilités du transporteur.',
 sections:[['Transport maritime','Pour les véhicules, motos et marchandises selon les conditions acceptées. Le dossier peut comprendre enlèvement, conteneurisation, fret, transbordement et escales. Le document de transport maritime authentique peut être partagé dans le dossier.'],
 ['Transport aérien','Une solution à étudier selon la marchandise, ses dimensions, son poids et les conditions du transporteur. Les vols, délais et frais doivent être confirmés. Le document aérien authentique peut être joint au suivi.'],
 ['Transport terrestre','Les segments routiers peuvent relier un entrepôt, un port, une frontière ou le lieu de remise. L’adresse, la disponibilité et le créneau sont confirmés par l’agence.'],
 ['Prestations complémentaires','Manutention, documentation, transit, dédouanement, stockage et livraison finale sont détaillés selon les besoins réels. Les honoraires du prestataire sont distingués des droits et taxes.']]},
 process:{title:'Comment ça marche',intro:'Chaque dossier suit les étapes adaptées à son parcours réel.',
 sections:[['1. Achat et dossier','L’agence enregistre le client, les références de l’achat effectué ailleurs, la première facture, la marchandise et la destination souhaitée. La création du dossier ne confirme ni paiement ni départ.'],
 ['2. Réception et préparation','Après confirmation de réception, l’agence prépare les segments de transport. Les escales et les dates prévues restent identifiées comme prévisions.'],
 ['3. Transport et informations','L’agence publie les départs, escales, changements et arrivées confirmés. Consultez votre référence ou votre lien privé pour retrouver la dernière information.'],
 ['4. Factures et paiements','Les prestations nécessaires sont expliquées séparément. Déposez une preuve sur la facture concernée ; seule l’agence confirme la réception réelle des fonds.'],
 ['5. Arrivée et remise','Une arrivée au port ou à l’aéroport ne signifie pas livraison. Les formalités, la mise à disposition et la remise effective sont confirmées séparément.']]},
 pricing:{title:'Transport et frais',intro:'Le prix d’achat du produit et les prestations de transport sont distincts. Aucun tarif universel ne peut être confirmé sans examiner votre dossier.',
 sections:[['Ce qui détermine les frais','Le trajet, le mode de transport, le volume, le poids, les prestations demandées et les contraintes de destination influencent le devis. La disponibilité et les frais sont confirmés avant l’engagement correspondant.'],
 ['Des prestations détaillées','Chaque facture précise la prestation réelle, son motif, son prestataire, les montants et les instructions de paiement. Les frais de stockage, surestaries ou détention ne sont applicables que lorsque la situation le justifie.'],
 ['Montants et conversions','Les montants client sont présentés en USD et GNF. La source et la date des taux doivent être renseignées ; les conversions de chaque facture émise restent figées.'],
 ['Paiement et suivi','Une preuve déposée reste en vérification jusqu’à la validation de réception des fonds par l’agence. Une attente financière ne modifie pas les mouvements déjà confirmés.']]},
 contact:{title:'Préparer mon envoi',intro:'Présentez votre besoin. L’agence doit confirmer la disponibilité, le trajet, la destination et les frais avant tout engagement.',
 sections:[['Assistance','Vous pouvez joindre l’assistant avec le bouton WhatsApp. Le message est préparé pour vous ; vous pouvez le modifier avant de l’envoyer.']]}
};
export default function PublicInformation({kind,onRequest}:{kind:string;onRequest:()=>void}){
 const page=publicPages[kind]||publicPages.about;
 return <div className="wrap information-page"><a className="back-link" href="/">{tr('← Retour à l’accueil')}</a><p className="eyebrow">{tr('TRANSWORLD DELIVERY')}</p><h1>{tr(page.title)}</h1><p className="section-copy">{tr(page.intro)}</p><div className="information-grid">{page.sections.map(([title,copy])=><section className="panel info-panel" key={title}><h2>{tr(title)}</h2><p>{tr(copy)}</p></section>)}</div><div className="information-actions"><button className="btn primary" onClick={onRequest}>{tr('Faire une demande')}</button><a className="btn secondary" href="/#tracking">{tr('Suivre une expédition')}</a></div></div>;
}
