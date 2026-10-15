'use client';
import { tr } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { Car, MapPin, Maximize, ExternalLink } from 'lucide-react';

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
}

export default function RouteMap({ events, reference = '' }: { events: any[]; reference?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const points: MapPoint[] = events
    .filter(e => typeof e.lat === 'number' && typeof e.lng === 'number' && !isNaN(e.lat) && !isNaN(e.lng))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const actual = points.filter(e => !e.planned);
  const last = actual[actual.length - 1];
  const coords = JSON.stringify(points.map(e => [e.id,e.lat,e.lng,e.planned,e.place,e.date,e.type,e.mode,e.note]));

  useEffect(() => {
    let dead = false;
    let mapInstance: any = null;
    let resizeObserver: ResizeObserver | null = null;

    setReady(false);
    setError('');

    if (!points.length || !host.current) return;

    fetch('/api/config?ref=' + encodeURIComponent(reference))
      .then(r => r.json())
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
            center: [last?.lat ?? points[0].lat, last?.lng ?? points[0].lng],
            zoom: 5,
            zoomControl: true,
            attributionControl: true,
            scrollWheelZoom: 'center',
          });
          mapInstance = map;

          // Tile Layer following OpenStreetMap usage policy (on-demand only, visible attribution, no prefetch)
          L.tileLayer(tileUrl, {
            attribution,
            maxZoom: 19,
            subdomains: ['a', 'b', 'c'],
          }).addTo(map);

          // Confirmed route polyline
          if (actual.length > 1) {
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
          if (plannedStops.length > 0) {
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
          const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));

          for (const point of points) {
            const isVehicle = point === last;
            let icon: any;

            if (isVehicle) {
              icon = L.divIcon({
                className: 'leaflet-vehicle-div',
                html: `<div class="map-car" title="${escapeHtml(point.place)} — Dernière position confirmée"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 11 2-5h10l2 5M4 11h16v7H4zM6 18v2m12-2v2M7 14h2m6 0h2"/></svg></div>`,
                iconSize: [46, 46],
                iconAnchor: [23, 23],
                popupAnchor: [0, -23],
              });
            } else if (point.planned) {
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
                  ${isVehicle ? 'Dernière position confirmée' : point.planned ? 'Étape prévue' : 'Étape confirmée'}
                </span>
                ${point.mode ? `<div style="color:#617274;font-size:11px;">Mode : <b>${escapeHtml(point.mode)}</b></div>` : ''}
                <div style="color:#617274;font-size:11px;margin-top:2px;">Date : ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(point.date))}</div>
                ${point.note ? `<div style="margin-top:4px;color:#352b25;font-size:11px;border-top:1px solid #eee;padding-top:4px;">${escapeHtml(point.note)}</div>` : ''}
              </div>
            `;
            marker.bindPopup(popupContent);
          }

          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [45, 45], maxZoom: 13 });
          }

          resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
          });
          resizeObserver.observe(host.current);

          setReady(true);
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
  }, [coords, reference]);

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
          <h2>{tr('Votre parcours sur la carte')}</h2>
          <p className="tiny muted">{tr('Dernière position confirmée • liaison entre étapes indicative')}</p>
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

      <div
        ref={host}
        className={'google-map ' + (ready ? 'ready' : '')}
        style={{ height: '380px', width: '100%', borderRadius: '7px' }}
        aria-label={tr('Carte interactive OpenStreetMap des étapes')}
      />

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
            <h3>{tr('La position reste à renseigner.')}</h3>
            <p>{tr('Le repère apparaîtra lorsque l’agence publiera une étape avec ses coordonnées.')}</p>
          </div>
        )
      )}

      <div className="map-caption">
        <div>
          <Car size={17} />
          <span>
            {last
              ? last.place +
                ' • ' +
                new Intl.DateTimeFormat('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(last.date))
              : 'Aucune position confirmée'}
          </span>
        </div>
        {last && (
          <a
            href={`https://www.openstreetmap.org/?mlat=${last.lat}&mlon=${last.lng}#map=12/${last.lat}/${last.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {tr('Ouvrir sur OpenStreetMap')}
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {error && (
        <p className="tiny muted map-warning">
          {tr(error)} {tr('Ce schéma ne représente pas une position GPS en direct.')}
        </p>
      )}
    </section>
  );
}
