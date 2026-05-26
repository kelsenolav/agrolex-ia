"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, MapPin, Layers, Globe, Compass } from "lucide-react";

export default function InteractiveMap({ lat = -17.6521, lng = -51.0429 }: { lat?: number; lng?: number }) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(false);
  const mapRef = useRef<any>(null);
  const containerId = "agrolex-leaflet-map";

  useEffect(() => {
    // 1. Evitar executar no Server-Side
    if (typeof window === "undefined") return;

    let isMounted = true;

    // 2. Função para inicializar o Leaflet
    const initLeaflet = () => {
      const L = (window as any).L;
      if (!L) return;

      // Limpar contêiner do Leaflet se ele já foi inicializado anteriormente no DOM
      const container = L.DomUtil.get(containerId);
      if (container) {
        container._leaflet_id = null;
      }

      // Limpar mapa antigo se existir
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.warn("Erro ao desmontar mapa anterior:", e);
        }
        mapRef.current = null;
      }

      // Criar mapa
      try {
        const centerCoords: [number, number] = [lat, lng];
        const map = L.map(containerId).setView(centerCoords, 13);
        mapRef.current = map;

        // Base Satélite (Esri World Imagery)
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Esri, USDA, USGS, Garmin",
            maxZoom: 19,
          }
        ).addTo(map);

        // Coordenadas da Fazenda calculadas dinamicamente baseadas no centro fornecido
        const farmCoords: [number, number][] = [
          [lat + 0.007, lng - 0.012],
          [lat + 0.009, lng + 0.010],
          [lat - 0.010, lng + 0.012],
          [lat - 0.014, lng - 0.008],
          [lat + 0.007, lng - 0.012],
        ];

        // Desenhar Fazenda em Verde/Ouro
        const farmPoly = L.polygon(farmCoords, {
          color: "#d4af37", // Borda Ouro
          fillColor: "#051F15", // Preenchimento Verde Escuro
          fillOpacity: 0.3,
          weight: 3,
        }).addTo(map);
        
        farmPoly.bindPopup(`
          <div style="font-family: sans-serif; padding: 4px;">
            <strong style="color: #051F15;">Perímetro da Propriedade</strong><br/>
            <span>Área Total: 420,5 ha</span><br/>
            <span style="color: #16a34a; font-weight: bold;">Status SIGEF: Homologado</span>
          </div>
        `);

        // Coordenadas da Área de Sobreposição calculadas dinamicamente
        const overlapCoords: [number, number][] = [
          [lat - 0.005, lng - 0.006],
          [lat - 0.011, lng + 0.008],
          [lat - 0.016, lng],
          [lat - 0.005, lng - 0.006],
        ];

        // Desenhar Área de Risco em Vermelho
        const overlapPoly = L.polygon(overlapCoords, {
          color: "#dc2626", // Borda Vermelha
          fillColor: "#ef4444", // Preenchimento Vermelho Claro
          fillOpacity: 0.5,
          weight: 2,
          dashArray: "5, 5",
        }).addTo(map);

        overlapPoly.bindPopup(`
          <div style="font-family: sans-serif; padding: 4px; color: #991b1b;">
            <strong style="display: flex; align-items: center; gap: 4px;">🚨 ALERTA CRÍTICO</strong>
            <span>Sobreposição Detectada</span><br/>
            <strong>Área Afetada: 59,6 ha (14,2%)</strong>
          </div>
        `);

        // Centralizar mapa nas áreas
        map.fitBounds(farmPoly.getBounds());

        if (isMounted) setMapLoaded(true);
      } catch (err) {
        console.error("Erro ao inicializar mapa Leaflet:", err);
        if (isMounted) setError(true);
      }
    };

    // 3. Carregar scripts de forma dinâmica para evitar erros de compilação
    const L = (window as any).L;
    if (L) {
      initLeaflet();
    } else {
      // Injetar Folha de Estilo
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Injetar Script JS
      if (!document.getElementById("leaflet-js")) {
        const script = document.createElement("script");
        script.id = "leaflet-js";
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => {
          initLeaflet();
        };
        script.onerror = () => {
          if (isMounted) setError(true);
        };
        document.head.appendChild(script);
      } else {
        // Script existe mas ainda está carregando
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
  }, [lat, lng]);

  if (error) {
    return (
      <div className="h-96 w-full rounded-xl bg-red-50 border border-red-200 flex flex-col items-center justify-center text-red-700 p-6">
        <AlertTriangle size={48} className="mb-4" />
        <p className="font-bold text-lg">Erro ao carregar o mapa satélite</p>
        <p className="text-sm text-red-500 text-center mt-1">Verifique sua conexão de rede.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-5 print:hidden">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
          <Layers className="text-brand-green" size={22} /> Monitoramento Geoespacial Ativo (SIGEF/CAR)
        </h3>
        <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 rounded-full text-xs font-bold text-red-700 animate-pulse">
          <AlertTriangle size={12} /> Risco Geoespacial: Alto
        </span>
      </div>

      <div className="relative">
        {/* Container Real do Leaflet */}
        <div
          id={containerId}
          className="h-96 w-full rounded-xl border border-gray-200 overflow-hidden shadow-inner z-10"
        />

        {!mapLoaded && (
          <div className="absolute inset-0 bg-gray-50 flex items-center justify-center text-gray-500 rounded-xl z-20">
            Carregando camadas do mapa...
          </div>
        )}
      </div>

      {/* Legenda do Mapa */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-semibold text-gray-600">
        <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
          <span className="w-4 h-4 bg-[#051F15]/30 border-2 border-brand-gold rounded"></span>
          <span>Fazenda: 420.5ha</span>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
          <span className="w-4 h-4 bg-red-500/50 border-2 border-red-600 border-dashed rounded animate-pulse"></span>
          <span className="text-red-700">Reserva Indígena (59.6ha)</span>
        </div>
        <div className="col-span-2 md:col-span-1 flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
          <MapPin className="text-brand-gold" size={16} />
          <span>Coord: {lat.toFixed(4)}, {lng.toFixed(4)}</span>
        </div>
      </div>

      {/* Botão Google Earth 3D e Google Maps Satélite */}
      <div className="bg-gradient-to-r from-blue-950/5 to-emerald-950/5 border border-gray-200/50 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-600 border border-blue-500/20">
            <Globe className="animate-pulse" size={24} />
          </div>
          <div>
            <h4 className="font-bold text-gray-800 text-sm">Visualização Geoespacial 3D e Satélite</h4>
            <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
              Explore o relevo em 3D no Google Earth ou acesse a imagem de satélite mais atual disponível no Google Maps.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <a
            href={`https://www.google.com/maps/@${lat},${lng},15z/data=!3m1!1e3`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer text-center"
          >
            <Layers size={14} /> Imagem Satélite Mais Atual (Maps)
          </a>
          <a
            href={`https://earth.google.com/web/@${lat},${lng},0a,8000d`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer text-center"
          >
            <Compass size={14} /> Abrir no Google Earth 3D
          </a>
        </div>
      </div>
    </div>
  );
}
