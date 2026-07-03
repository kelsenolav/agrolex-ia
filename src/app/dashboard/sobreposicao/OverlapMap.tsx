"use client";

import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Feature } from 'geojson';

interface AchadoGeo {
  classe: string;
  severidade: string;
  nome: string;
  geometria_intersecao: Feature | null;
}

const SEVERITY_COLOR: Record<string, string> = {
  critica: '#dc2626',
  alta: '#ea580c',
  media: '#d97706',
  baixa: '#2563eb',
};

export default function OverlapMap({
  imovel,
  achados,
  bbox,
}: {
  imovel: Feature;
  achados: AchadoGeo[];
  bbox: [number, number, number, number];
}) {
  const bounds: [[number, number], [number, number]] = [
    [bbox[1], bbox[0]],
    [bbox[3], bbox[2]],
  ];

  return (
    <MapContainer bounds={bounds} style={{ height: 420, width: '100%', borderRadius: 12 }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON
        data={imovel}
        style={{ color: '#064e3b', weight: 2, fillColor: '#059669', fillOpacity: 0.15 }}
      />
      {achados.filter((a) => a.geometria_intersecao).map((a, i) => (
        <GeoJSON
          key={i}
          data={a.geometria_intersecao as Feature}
          style={{
            color: SEVERITY_COLOR[a.severidade] ?? '#6b7280',
            weight: 1,
            fillColor: SEVERITY_COLOR[a.severidade] ?? '#6b7280',
            fillOpacity: 0.45,
          }}
        />
      ))}
    </MapContainer>
  );
}
