// Mock GPS — small drift around a base point (Bangalore default)
const BASE: [number, number] = [12.9716, 77.5946];

export function getMockLocation(seed = 0): { lat: number; lng: number } {
  const t = (Date.now() / 8000 + seed) % (Math.PI * 2);
  return {
    lat: BASE[0] + Math.sin(t) * 0.004 + (Math.random() - 0.5) * 0.0006,
    lng: BASE[1] + Math.cos(t) * 0.004 + (Math.random() - 0.5) * 0.0006,
  };
}

export const NEARBY = [
  { id: "p1", name: "Indiranagar Police Station", type: "police", lat: 12.9719, lng: 77.5995 },
  { id: "p2", name: "Cubbon Park Police Outpost", type: "police", lat: 12.9763, lng: 77.5929 },
  { id: "h1", name: "Manipal Hospital", type: "hospital", lat: 12.9606, lng: 77.6486 },
  { id: "h2", name: "Apollo Clinic", type: "hospital", lat: 12.9784, lng: 77.594 },
];
