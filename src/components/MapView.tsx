import { useEffect, useRef } from "react";
import L from "leaflet";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  emergency?: boolean;
  popupHtml?: string;
};
export type MapZone = { id: string; lat: number; lng: number; radius_m: number; name?: string };

export function MapView({
  center,
  markers = [],
  zones = [],
  path = [],
  height = 320,
}: {
  center: [number, number];
  markers?: MapMarker[];
  zones?: MapZone[];
  path?: [number, number][];
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      center,
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    zones.forEach((z) => {
      L.circle([z.lat, z.lng], {
        radius: z.radius_m,
        color: "oklch(0.78 0.14 200)",
        fillColor: "oklch(0.78 0.14 200)",
        fillOpacity: 0.1,
        weight: 1.5,
      })
        .bindTooltip(z.name ?? "Safe zone")
        .addTo(layer);
    });

    if (path.length > 1) {
      L.polyline(path, { color: "oklch(0.78 0.14 200)", weight: 3, opacity: 0.7 }).addTo(layer);
    }

    markers.forEach((m) => {
      const color = m.color ?? (m.emergency ? "oklch(0.62 0.24 25)" : "oklch(0.78 0.14 200)");
      const html = `<div style="position:relative">
        <div style="width:18px;height:18px;border-radius:50%;background:${color};box-shadow:0 0 0 4px ${color}33,0 0 14px ${color};border:2px solid white"></div>
        ${m.emergency ? `<div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid ${color};animation:pulseRing 1.6s infinite"></div>` : ""}
      </div>`;
      const icon = L.divIcon({ html, className: "", iconSize: [18, 18], iconAnchor: [9, 9] });
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(layer);
      if (m.popupHtml) marker.bindPopup(m.popupHtml);
      else if (m.label) marker.bindTooltip(m.label);
    });

    map.setView(center, map.getZoom());
  }, [JSON.stringify(markers), JSON.stringify(zones), JSON.stringify(path), center[0], center[1]]);

  return <div ref={ref} style={{ height }} className="w-full overflow-hidden rounded-2xl" />;
}
