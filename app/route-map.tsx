'use client';
import {bearing,routeGeometry,type RouteConfig} from './maritime';
import { tr } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { Ship, Plane, Truck, MapPin, Maximize, RefreshCw } from 'lucide-react';

const escapeHtml=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

interface MapPoint {
  id?: string;
  lat: number;
  lng: number;
  place: string;
  date: string;
  type?: string;
  mode?: string;
  note?: string;
  planned?: number;
  estimated?: boolean;
}

export default function RouteMap({ events, reference = '',mode='',origin='',destination='',route }: { events: any[]; reference?: string;mode?:string;origin?:string;destination?:string;route?:RouteConfig }) {
  const box = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const mapRef=useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [retry,setRetry]=useState(0),[tilesLoaded,setTilesLoaded]=useState(false);

  const points: MapPoint[] = events
    .filter(e => typeof e.lat === 'number' && typeof e.lng === 'number' && !isNaN(e.lat) && !isNaN(e.lng))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const actual = points.filter(e => !e.planned&&!e.estimated);
  const estimate=points.filter(e=>!e.planned&&e.estimated).at(-1);
  const displayPosition=estimate&&(!actual.at(-1)||estimate.date>actual.at(-1)!.date)?estimate:actual.at(-1);
  const geometry=routeGeometry(route);
  const last = actual[actual.length - 1];
  const selected=displayPosition?.mode||mode||route?.mode||'Maritime',Icon=selected==='Aérien'?Plane:selected==='Terrestre'?Truck:Ship;
  const coords = JSON.stringify(points.map(e => [e.id,e.lat,e.lng,e.planned,e.place,e.date,e.type,e.mode,e.note,e.estimated]));

  useEffect(() => {
    let dead = false;
    let mapInstance: any = null;
    let resizeObserver: ResizeObserver | null = null;

    setReady(false);
    setError('');
    setTilesLoaded(false);

    if (!host.current) return;

    fetch('/api/config?ref=' + encodeURIComponent(reference))
      .then(r => r.ok?r.json():{})
      .catch(()=>({}))
      .then(async (c: any) => {
        if (dead || !host.current) return;

        try {
          const L = (await import('leaflet')).default;
          if (dead || !host.current) return;

          // Clear any leftover Leaflet container markings
          if ((host.current as any)._leaflet_id) {
            (host.current as any)._leaflet_id = null;
          }
          host.current.innerHTML = '';

          const tileUrl = c.tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
          const attribution = c.attribution || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

          const map = L.map(host.current, {
            center: [last?.lat ?? points[0]?.lat ?? 12, last?.lng ?? points[0]?.lng ?? 25],
            zoom: points.length?5:2,
            zoomControl: true,
            attributionControl: true,
            scrollWheelZoom: 'center',
          });
          mapInstance = map;mapRef.current=map;
          if(geometry.length>1)L.polyline(geometry,{color:"#b29354",weight:3,dashArray:"6,8",opacity:.85}).addTo(map);

          // Tile Layer following OpenStreetMap usage policy (on-demand only, visible attribution, no prefetch)
          const tiles=L.tileLayer(tileUrl, {
            attribution,
            maxZoom: 19,
            subdomains: ['a', 'b', 'c'],
          }).on('tileload',()=>{if(!dead){setTilesLoaded(true);setError('');}}).on('tileerror',()=>{if(!dead)setError('Le fond de carte n’a pas pu être chargé. Vérifiez votre connexion puis réessayez.');}).addTo(map);

          // Confirmed route polyline
          if (!route&&actual.length > 1) {
            const confirmedLatLngs = actual.map(p => [p.lat, p.lng] as [number, number]);
            L.polyline(confirmedLatLngs, {
              color: '#126474',
              weight: 4,
              opacity: 0.9,
              lineJoin: 'round',
            }).addTo(map);
          }

          // Planned forecast route polyline (connecting last confirmed to planned stops)
          const plannedStops = points.filter(e => e.planned);
          if (!route&&plannedStops.length > 0) {
            const plannedPoints = last ? [last, ...plannedStops] : plannedStops;
            if (plannedPoints.length > 1) {
              const plannedLatLngs = plannedPoints.map(p => [p.lat, p.lng] as [number, number]);
              L.polyline(plannedLatLngs, {
                color: '#b29354',
                weight: 3,
                dashArray: '6, 8',
                opacity: 0.8,
                lineJoin: 'round',
              }).addTo(map);
            }
          }

          // Markers for each stop
          const bounds = L.latLngBounds([...points.map(p => [p.lat, p.lng] as [number,number]),...geometry]);

          for (const point of points) {
            const isVehicle = point === displayPosition;
            const next=route?.points.find((p,i)=>i>0&&route.points[i-1].lat===point.lat&&route.points[i-1].lng===point.lng);
            const angle=next?bearing(point,next):0;
            let icon: any;
            const visualMode=point.mode||mode||route?.mode||'Maritime';
            const vehiclePath=visualMode==='Maritime'?'<path d="M4 16 2 11l10-4 10 4-2 5M6 9V4h12v5M12 7v9M2 20q3-3 5 0 3-3 5 0 3-3 5 0 3-3 5 0"/>':visualMode==='Aérien'?'<path d="m22 2-7 20-4-9-9-4Z M22 2 11 13"/>':'<path d="M2 5h13v12H2zM15 9h4l3 4v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>';

            if (isVehicle) {
              icon = L.divIcon({
                className: 'leaflet-vehicle-div',
                html: `<div class="map-car map-transport" title="${escapeHtml(point.place)} — ${point.estimated?"Zone estimée":"Position confirmée par votre transporteur"}"><svg style="transform:rotate(${angle}deg)" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8">${vehiclePath}</svg>${next?'<span class="map-heading-arrow" style="transform:rotate('+angle+'deg)" aria-label="Sens indicatif vers le prochain repère">↑</span>':''}</div>`,
                iconSize: [46, 46],
                iconAnchor: [23, 23],
                popupAnchor: [0, -23],
              });
            } else if (point.planned||point.estimated) {
              icon = L.divIcon({
                className: 'leaflet-stop-div',
                html: `<div class="map-point planned" style="background:#b29354;border:2px solid #fff;color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.18);">○</div>`,
                iconSize: [22, 22],
                iconAnchor: [11, 11],
                popupAnchor: [0, -11],
              });
            } else {
              icon = L.divIcon({
                className: 'leaflet-stop-div',
                html: `<div class="map-point" style="background:#126474;border:2px solid #fff;color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.18);">✓</div>`,
                iconSize: [22, 22],
                iconAnchor: [11, 11],
                popupAnchor: [0, -11],
              });
            }

            const marker = L.marker([point.lat, point.lng], {
              icon,
              zIndexOffset: isVehicle ? 1000 : 100,
            }).addTo(map);

            const popupContent = `
              <div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.4;padding:4px;min-width:180px;">
                <strong style="display:block;font-size:13px;color:#163941;margin-bottom:4px;">${escapeHtml(point.place)}</strong>
                <span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:600;margin-bottom:6px;${point.planned ? 'background:#f9ecd8;color:#885331;' : 'background:#e9f2f2;color:#126474;'}">
                  ${point.estimated?'Zone estimée · pas de GPS':isVehicle ? 'Position confirmée par votre transporteur' : point.planned ? 'Étape prévue' : 'Étape confirmée'}
                </span>
                ${point.mode ? `<div style="color:#617274;font-size:11px;">Mode : <b>${escapeHtml(point.mode)}</b></div>` : ''}
                <div style="color:#617274;font-size:11px;margin-top:2px;">Date : ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(point.date))}</div>
                ${point.note ? `<div style="margin-top:4px;color:#352b25;font-size:11px;border-top:1px solid #eee;padding-top:4px;">${escapeHtml(point.note)}</div>` : ''}
              </div>
            `;
            marker.bindPopup(popupContent);
            marker.bindTooltip(escapeHtml(point.place));
            if(isVehicle)marker.openPopup();
          }

          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [45, 45], maxZoom: 13 });
          }

          resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
          });
          resizeObserver.observe(host.current);

          setReady(true);
          requestAnimationFrame(()=>{if(!dead){map.invalidateSize({pan:false});if(bounds.isValid())map.fitBounds(bounds,{padding:[45,45],maxZoom:13});tiles.redraw();}});
        } catch (err: any) {
          if (!dead) {
            console.error('Erreur Leaflet:', err);
            setError('Impossible de charger la carte Leaflet.');
          }
        }
      })
      .catch(() => {
        if (!dead) setError('Configuration cartographique indisponible.');
      });

    return () => {
      dead = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, reference,mode,retry,JSON.stringify(route)]);

  const minLng = Math.min(...points.map(e => e.lng));
  const maxLng = Math.max(...points.map(e => e.lng));
  const minLat = Math.min(...points.map(e => e.lat));
  const maxLat = Math.max(...points.map(e => e.lat));
  const project = (p: any) => ({
    x: 40 + ((p.lng - minLng) / Math.max(1, maxLng - minLng)) * 520,
    y: 220 - ((p.lat - minLat) / Math.max(1, maxLat - minLat)) * 170,
  });

  return (
    <section className="panel route-map" ref={box}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">VISIBILITÉ DU PARCOURS</p><h2>{tr('Votre parcours sur la carte')}</h2>
          <p className="tiny muted">{displayPosition?.estimated?'Zone estimée publiée par l’agence · aucun GPS en direct':tr('Position confirmée par votre transporteur · date de mise à jour affichée')}</p>
        </div>
        <button
          className="icon-btn"
          aria-label={tr('Agrandir la carte')}
          onClick={() => {
            if (!document.fullscreenElement) {
              box.current?.requestFullscreen?.().catch(() => setError('Utilisez le zoom de votre navigateur.'));
            } else {
              document.exitFullscreen?.();
            }
          }}
        >
          <Maximize size={18} />
        </button>
      </div>

      <div className="map-tools"><button type="button" className="btn secondary" onClick={()=>{const bounds=[...points.map(p=>[p.lat,p.lng]),...geometry];if(bounds.length)mapRef.current?.fitBounds(bounds,{padding:[35,35],maxZoom:13});}}>Voir tout le trajet</button><button type="button" className="btn secondary" disabled={!displayPosition} onClick={()=>{if(displayPosition)mapRef.current?.setView([displayPosition.lat,displayPosition.lng],7);}}>Dernière position publiée</button></div><div className="map-route-strip"><div><small>DÉPART</small><strong>{origin||'Départ à confirmer'}</strong></div><Icon size={28}/><div><small>DESTINATION</small><strong>{destination||'Arrivée à confirmer'}</strong></div></div>
      <div
        ref={host}
        className={'google-map ' + (ready ? 'ready' : '')}
        style={{ display:'block',height: '440px', width: '100%', borderRadius: '7px',background:'#dce9ed' }}
        aria-label={tr('Carte interactive OpenStreetMap des étapes')}
      />

      {ready&&!points.length&&<div className="map-context"><Icon size={24}/><div><strong>Dossier enregistré · parcours en préparation</strong><p>Vue générale. Votre agence publiera les coordonnées des points du trajet.</p></div></div>}
      {!ready && (
        points.length ? (
          <div className="map-schematic">
            <svg viewBox="0 0 600 260" role="img" aria-label={tr('Schéma illustratif des coordonnées des étapes')}>
              <defs>
                <pattern id="map-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#d8e5de" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="600" height="260" fill="#f0f5ef" />
              <rect width="600" height="260" fill="url(#map-grid)" />
              <polyline
                points={points.map(p => {
                  const q = project(p);
                  return q.x + ',' + q.y;
                }).join(' ')}
                fill="none"
                stroke="#4f8c95"
                strokeWidth="2"
                strokeDasharray="6 5"
              />
              <polyline
                points={actual.map(p => {
                  const q = project(p);
                  return q.x + ',' + q.y;
                }).join(' ')}
                fill="none"
                stroke="#126474"
                strokeWidth="3"
              />
              {points.map((p, i) => {
                const q = project(p);
                return (
                  <g key={p.id || i} transform={`translate(${q.x},${q.y})`}>
                    <circle r={p === last ? 18 : 6} fill={p === last ? '#126474' : p.planned ? '#c4aa79' : '#66876f'} />
                    {p === last && (
                      <g transform="translate(-11,-11)" stroke="#fff" fill="none" strokeWidth="1.7">
                        <path d="m4 10 3-5h10l3 5M3 10h18v8H3zM6 18v2m12-2v2M6 13h3m6 0h3" />
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
            <span>{tr('Schéma du trajet')}</span>
          </div>
        ) : (
          <div className="empty">
            <MapPin />
            <h3>{tr('Préparation de votre carte')}</h3>
            <p>{tr('Les étapes et lieux publiés par votre agence seront présentés sur cette carte.')}</p>
          </div>
        )
      )}

      <div className="map-caption">
        <div>
          <Icon size={17} />
          <span>
            {displayPosition
              ? (displayPosition.estimated?'Zone estimée · ':'Position confirmée · ')+displayPosition.place +
                ' • ' +
                new Intl.DateTimeFormat('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(displayPosition.date))
              : 'Localisation précise en attente de confirmation par l’agence'}
          </span>
        </div>
        <button type="button" className="btn secondary" onClick={()=>setRetry(v=>v+1)}><RefreshCw size={13}/> Recharger la carte</button>
      </div>

      <div className="map-legend"><span><i className="legend-confirmed"/> Étape confirmée</span><span><i className="legend-planned"/> Étape prévue</span></div><p className="tiny muted">{displayPosition?.estimated?"Zone estimée publiée séparément des positions confirmées.":actual.length?"Les étapes datées sont confirmées et publiées par votre transporteur. Le tracé du parcours prévu reste distinct des positions publiées.":"Les positions publiées par votre transporteur apparaîtront sur cette carte."}</p>
      {ready&&!tilesLoaded&&!error&&<p className="tiny muted">Chargement du fond cartographique…</p>}
      {error && (
        <p className="tiny muted map-warning">
          {tr(error)} {tr('Ce schéma ne représente pas une position GPS en direct.')}
        </p>
      )}
    </section>
  );
}
