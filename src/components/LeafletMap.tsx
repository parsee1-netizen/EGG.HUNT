"use client";

import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapEgg, MapProps } from "./map-types";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

function eggIcon(label?: string) {
  return L.divIcon({
    className: "egg-pin",
    html: `<div class="pin"><div class="e"></div>${label ? `<small>${escapeHtml(label)}</small>` : ""}</div>`,
    iconSize: label ? [96, 64] : [36, 46],
    iconAnchor: label ? [48, 40] : [18, 42],
  });
}

const storeIcon = L.divIcon({
  className: "egg-pin",
  html: `<div class="store-pin">🏪</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const meIcon = L.divIcon({
  className: "egg-pin",
  html: `<div class="me-dot"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function Invalidate() {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(id);
  }, [map]);
  return null;
}

export default function LeafletMap({
  center,
  zoom = 16,
  eggs,
  businesses = [],
  player,
  circle,
  onEgg,
  height = 380,
}: MapProps) {
  const icons = useMemo(() => {
    const map = new Map<string, L.DivIcon>();
    for (const egg of eggs) map.set(egg.id, eggIcon(egg.label));
    return map;
  }, [eggs]);

  return (
    <div className="map" style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} zoomControl={false} attributionControl style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Invalidate />
        {circle ? (
          <Circle
            center={[circle.lat, circle.lng]}
            radius={circle.radiusM}
            pathOptions={{ color: "#F4A900", fillColor: "#FFC93C", fillOpacity: 0.28, weight: 2, dashArray: "6 6" }}
          />
        ) : null}
        {businesses.map((b) => (
          <Marker key={b.id} position={[b.lat, b.lng]} icon={storeIcon} title={b.name} />
        ))}
        {player ? <Marker position={[player.lat, player.lng]} icon={meIcon} title="You" /> : null}
        {eggs.map((egg: MapEgg) => (
          <Marker
            key={egg.id}
            position={[egg.lat, egg.lng]}
            icon={icons.get(egg.id) ?? eggIcon(egg.label)}
            eventHandlers={onEgg ? { click: () => onEgg(egg.id) } : undefined}
          />
        ))}
      </MapContainer>
    </div>
  );
}
