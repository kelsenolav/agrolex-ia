"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, MapPin, Layers } from "lucide-react";

export default function InteractiveMap() {
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
        const centerCoords: [number, number] = [-17.785, -50.92];
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

        // Coordenadas da Fazenda (Rio Verde - GO)
        const farmCoords: [number, number][] = [
          [-17.778, -50.932],
          [-17.776, -50.910],
          [-17.795, -50.908],
          [-17.799, -50.928],
          [-17.778, -50.932],
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
            <strong style="color: #051F15;">Fazenda Boa Esperança</strong><br/>
            <span>Área Total: 420,5 ha</span><br/>
            <span style="color: #16a34a; font-weight: bold;">Status SIGEF: Homologado</span>
          </div>
        `);

        // Coordenadas da Área de Sobreposição (Área indígena ou APP)
        const overlapCoords: [number, number][] = [
          [-17.790, -50.918],
          [-17.796, -50.908],
          [-17.801, -50.920],
          [-17.790, -50.918],
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
            <span>Sobreposição com Reserva Indígena Kadiwéu</span><br/>
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
  }, []);

  if (error) {
    return (
      <div className="h-96 w-full rounded-xl bg-red-50 border border-red-200 flex flex-col items-center justify-center text-red-700 p-6">
        <AlertTriangle size={48} className="mb-4" />
        <p className="font-bold text-lg">Erro ao carregar o mapa satélite</p>
        <p className="text-sm text-red-500 text-center mt-1">Verifique sua conexão de rede ou as credenciais.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4 print:hidden">
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2 text-xs font-semibold text-gray-600">
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
          <span>Rio Verde, GO (SIGEF)</span>
        </div>
      </div>
    </div>
  );
}
