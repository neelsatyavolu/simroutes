export const AIRPORT_SIZES = ["large", "medium", "small"] as const;
export type AirportSize = (typeof AIRPORT_SIZES)[number];

export interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  size: AirportSize;
  lat: number;
  lon: number;
}

/** One scheduled flight as seen on a departures board. Stored in data/flights.json. */
export interface FlightRecord {
  id: string;
  flightNumber: string;
  airline: { name: string; iata: string; icao: string };
  /** Every aircraft type seen operating this flight during the pulled week. */
  aircraft: string[];
  depIcao: string;
  arrIcao: string;
  /** Local scheduled departure time, "HH:MM". */
  depLocal: string;
  arrLocal: string;
  durationMin: number;
  seenAt: string;
}

/** A flight joined with its airport details, as returned by the search API. */
export interface FlightResult extends FlightRecord {
  dep: Airport | null;
  arr: Airport | null;
}

export interface SearchQuery {
  aircraft: string[];
  airlines: string[];
  dep?: string;
  arr?: string;
  minDuration?: number;
  maxDuration?: number;
  depSizes: AirportSize[];
  arrSizes: AirportSize[];
  sort: "duration" | "departure" | "airline";
  limit: number;
}

export interface SearchResponse {
  total: number;
  results: FlightResult[];
}

export interface OptionsResponse {
  aircraft: { model: string; count: number }[];
  airlines: { name: string; code: string; count: number }[];
  /** Airports that appear in the flight data, for autocomplete. */
  airports: { icao: string; iata: string; name: string; city: string }[];
  flightCount: number;
  updatedAt: string | null;
}
