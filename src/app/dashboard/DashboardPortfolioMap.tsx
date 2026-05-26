"use client";

import { useEffect, useRef, useState } from "react";
import { Layers, MapPin } from "lucide-react";

interface GeoProperty {
  id: string;
  name: string;
  lat: number;
  lng: number;
  risk: string;
  polygon?: [number, number][];
}

export default function DashboardPortfolioMap({ properties }: { properties: GeoProperty[] }) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<any>(null);
  const containerId = "agrolex-portfolio-map";

  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;

    const initLeaflet = () => {
      const L = (window as any).L;
      if (!L || !isMounted) return;

      const container = L.DomUtil.get(containerId);
      if (container) {
        container._leaflet_id = null;
      }

      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
      }

      // Default center if no properties, else center on first
      const defaultLat = properties.length > 0 ? properties[0].lat : -10.0500;
      const defaultLng = properties.length > 0 ? properties[0].lng : -48.2000;

      try {
        const map = L.map(containerId).setView([defaultLat, defaultLng], properties.length > 1 ? 8 : 12);
        mapRef.current = map;

        // Base Satélite (Esri World Imagery)
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Esri, USDA, USGS, Garmin",
            maxZoom: 19,
          }
        ).addTo(map);

        const group = L.featureGroup();

        properties.forEach(p => {
          const color = p.risk?.toLowerCase() === 'alto' ? '#dc2626' : p.risk?.toLowerCase() === 'medio' ? '#eab308' : '#16a34a';
          
          // Marker customizado colorido
          const marker = L.circleMarker([p.lat, p.lng], {
            radius: 8,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }).addTo(map);

          marker.bindPopup(`
            <div style="font-family: sans-serif; padding: 4px; color: #1e293b;">
              <strong style="font-size: 14px;">${p.name}</strong><br/>
              <span style="font-size: 12px; font-weight: bold; color: ${color};">Risco: ${p.risk || 'Pendente'}</span>
            </div>
          `);

          group.addLayer(marker);

          // Se tiver polígono KML/GPX desenha no mapa do portfólio também!
          if (p.polygon && p.polygon.length > 0) {
            const poly = L.polygon(p.polygon, {
              color: color,
              fillColor: color,
              fillOpacity: 0.15,
              weight: 2
            }).addTo(map);
            
            group.addLayer(poly);
          }
        });

        if (properties.length > 0) {
          map.fitBounds(group.getBounds(), { padding: [30, 30] });
        }

        if (isMounted) setMapLoaded(true);
      } catch (err) {
        console.error("Erro ao inicializar mapa do portfólio:", err);
      }
    };

    const L = (window as any).L;
    if (L) {
      initLeaflet();
    } else {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (!document.getElementById("leaflet-js")) {
        const script = document.createElement("script");
        script.id = "leaflet-js";
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => initLeaflet();
        document.head.appendChild(script);
      } else {
        const checker = setInterval(() => {
          if ((window as any).L) {
            clearInterval(checker);
            initLeaflet();
          }
        }, 100);
      }
    }

    return () => {
      isMounted = false;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
      }
    };
  }, [properties]);

  return (
    <div className="relative">
      <div id={containerId} className="h-80 w-full rounded-xl border border-gray-200 shadow-inner z-10" />
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-50 flex items-center justify-center text-gray-500 rounded-xl z-20">
          Carregando mapa consolidado...
        </div>
      )}
    </div>
  );
}
