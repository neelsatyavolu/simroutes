import type { AirportOption } from "./airport-search";

export const AIRPORT_SIZES = ["super-large", "large", "medium", "small", "mini"] as const;
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

export interface AirportsResponse {
  airports: Airport[];
}

export interface SceneryMatch {
  title: string;
  url: string;
  developer: string;
  compatibility: "native" | "compatible" | "tested";
  important: boolean;
}

export interface SceneryResponse {
  results: SceneryMatch[];
  recommendedUrl: string | null;
  sourceUrl: string;
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
  flightNumber?: string;
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

export interface LogbookFlightView {
  id: string;
  depIcao: string;
  arrIcao: string;
  aircraft: string | null;
  blockMinutes: number | null;
  flownAt: string | null;
  source: "csv" | "volanta" | "plan";
}

export interface LogbookResponse {
  flights: LogbookFlightView[];
}

export interface ImportResponse {
  added: number;
  /** Rows that were read but already in the logbook. */
  duplicates: number;
  errors: string[];
}

export interface SuggestionRowView {
  results: FlightResult[];
  relaxed: ("aircraft" | "duration")[];
}

export interface SuggestionsResponse {
  /** Null when the logbook is empty. */
  profile: {
    aircraft: string[];
    duration: { min: number; max: number; median: number } | null;
    lastArrival: Airport | { icao: string } | null;
    flightCount: number;
    visitedCount: number;
  } | null;
  continueFrom: (SuggestionRowView & { from: string }) | null;
  discover: SuggestionRowView | null;
}

export type { Plan } from "./planner/repo";
export type { OfpSummary } from "./planner/simbrief";

export interface NavigraphStatus {
  /** False until Navigraph client credentials are configured. */
  configured: boolean;
  alias: string | null;
}

export interface OptionsResponse {
  aircraft: { model: string; count: number }[];
  airlines: { name: string; code: string; count: number }[];
  /** Airports that appear in the flight data, for autocomplete. */
  airports: AirportOption[];
  flightCount: number;
  updatedAt: string | null;
}
