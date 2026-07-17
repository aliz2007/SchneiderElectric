// Schneider hub locations per APEX zone, projected into the map's 980×480 SVG space
// (same NaturalEarth1 projection as world-geo.ts — regenerate with
// scripts/generate-world-map.mjs / its cities helper if the projection changes).
// Account Managers are distributed across their zone's hubs round-robin by code —
// representative placement for the thermal field, not exact office data.

import type { MapZone } from "./world-geo";

export type Hub = { name: string; zone: MapZone; x: number; y: number };

export const HUBS: Hub[] = [
  { name: "Dubai", zone: "MEA", x: 637.7, y: 196.2 },
  { name: "Riyadh", zone: "MEA", x: 615.0, y: 197.8 },
  { name: "Cairo", zone: "MEA", x: 572.4, y: 180.7 },
  { name: "Casablanca", zone: "MEA", x: 470.2, y: 169.4 },
  { name: "Lagos", zone: "MEA", x: 499.3, y: 256.2 },
  { name: "Nairobi", zone: "MEA", x: 591.4, y: 280.9 },
  { name: "Johannesburg", zone: "MEA", x: 564.8, y: 360.5 },
  { name: "São Paulo", zone: "SAM", x: 364.9, y: 352.0 },
  { name: "Buenos Aires", zone: "SAM", x: 338.4, y: 387.5 },
  { name: "Santiago", zone: "SAM", x: 305.7, y: 383.8 },
  { name: "Lima", zone: "SAM", x: 279.2, y: 315.2 },
  { name: "Bogotá", zone: "SAM", x: 286.1, y: 261.8 },
  { name: "Caracas", zone: "SAM", x: 306.6, y: 243.3 },
  { name: "Mumbai", zone: "India", x: 687.4, y: 215.9 },
  { name: "Delhi", zone: "India", x: 694.1, y: 185.0 },
  { name: "Bangalore", zone: "India", x: 702.1, y: 235.4 },
  { name: "Chennai", zone: "India", x: 709.4, y: 235.0 },
  { name: "Kolkata", zone: "India", x: 727.6, y: 204.7 },
  { name: "Sydney", zone: "Pacific", x: 883.8, y: 385.1 },
  { name: "Melbourne", zone: "Pacific", x: 861.9, y: 397.7 },
  { name: "Auckland", zone: "Pacific", x: 940.0, y: 394.7 },
  { name: "Singapore", zone: "Pacific", x: 776.0, y: 272.5 },
  { name: "Jakarta", zone: "Pacific", x: 783.9, y: 296.5 },
  { name: "Hong Kong", zone: "Pacific", x: 797.2, y: 205.5 },
  { name: "Shanghai", zone: "Pacific", x: 809.2, y: 176.9 },
  { name: "Tokyo", zone: "Pacific", x: 851.4, y: 162.6 },
  { name: "Manila", zone: "Pacific", x: 820.0, y: 230.2 },
];
