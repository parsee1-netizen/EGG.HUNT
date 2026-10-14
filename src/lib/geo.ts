/** Eggs render in the camera only inside this radius. */
export const CATCH_RADIUS_M = 50;

const EARTH_M = 6_371_000;

export interface LatLng {
  lat: number;
  lng: number;
}

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const φ1 = (aLat * Math.PI) / 180;
  const φ2 = (bLat * Math.PI) / 180;
  const Δφ = ((bLat - aLat) * Math.PI) / 180;
  const Δλ = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return 2 * EARTH_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Destination point given a start, distance in meters, and bearing in degrees. */
export function destination(lat: number, lng: number, distanceMeters: number, bearingDeg: number): LatLng {
  const δ = distanceMeters / EARTH_M;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  const outLng = (((λ2 * 180) / Math.PI + 540) % 360) - 180;
  return {
    lat: round6((φ2 * 180) / Math.PI),
    lng: round6(outLng),
  };
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Uniform point inside a circle of radiusM, at least minM from the center. */
export function pointInDisk(
  lat: number,
  lng: number,
  radiusM: number,
  minM: number,
  random: () => number,
): LatLng {
  const inner = Math.max(0, minM);
  const outer = Math.max(inner, radiusM);
  const dist = Math.sqrt(random() * (outer * outer - inner * inner) + inner * inner);
  const bearing = random() * 360;
  return destination(lat, lng, dist, bearing);
}
