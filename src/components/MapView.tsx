"use client";

import dynamic from "next/dynamic";
import type { MapProps } from "./map-types";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="map map-loading" />,
});

export default function MapView(props: MapProps) {
  return <LeafletMap {...props} />;
}
