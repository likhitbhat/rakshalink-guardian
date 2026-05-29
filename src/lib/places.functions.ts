import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const Input = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(100).max(50000).default(5000),
});

export type PlaceType = "police" | "hospital" | "pharmacy";

export type NearbyPlace = {
  id: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  openNow?: boolean | null;
  address?: string;
};

async function searchNearby(
  apiKey: string,
  lovableKey: string,
  lat: number,
  lng: number,
  radius: number,
  type: PlaceType,
): Promise<NearbyPlace[]> {
  const includedTypes =
    type === "police" ? ["police"] : type === "hospital" ? ["hospital"] : ["pharmacy"];
  const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchNearby`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": apiKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.location,places.currentOpeningHours.openNow,places.formattedAddress",
    },
    body: JSON.stringify({
      includedTypes,
      maxResultCount: 8,
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius },
      },
    }),
  });
  const json = (await res.json()) as any;
  if (!res.ok) {
    console.error("Places nearby search failed", res.status, json);
    return [];
  }
  return (json.places ?? []).map((p: any) => ({
    id: p.id,
    name: p.displayName?.text ?? "Unknown",
    type,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    openNow: p.currentOpeningHours?.openNow ?? null,
    address: p.formattedAddress ?? undefined,
  }));
}

export const getNearbyPlaces = createServerFn({ method: "POST" })
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
    if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not configured");

    const [police, hospitals, pharmacies] = await Promise.all([
      searchNearby(apiKey, lovableKey, data.lat, data.lng, data.radius, "police"),
      searchNearby(apiKey, lovableKey, data.lat, data.lng, data.radius, "hospital"),
      searchNearby(apiKey, lovableKey, data.lat, data.lng, data.radius, "pharmacy"),
    ]);
    return { places: [...police, ...hospitals, ...pharmacies] };
  });
