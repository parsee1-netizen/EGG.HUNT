export interface MapPoint {
  lat: number;
  lng: number;
}

export interface MapEgg {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

export interface MapBusiness {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface MapProps {
  center: MapPoint;
  zoom?: number;
  eggs: MapEgg[];
  businesses?: MapBusiness[];
  player?: MapPoint | null;
  circle?: { lat: number; lng: number; radiusM: number } | null;
  onEgg?: (id: string) => void;
  height?: number;
}
