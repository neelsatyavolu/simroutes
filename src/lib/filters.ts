import type { AirportSize, SearchQuery } from "./types";

/** Form state for the route finder. Durations are typed in hours as free text. */
export interface Filters {
  regions: string[];
  flightNumber: string;
  aircraft: string[];
  airlines: string[];
  dep: string;
  arr: string;
  minHours: string;
  maxHours: string;
  depSizes: AirportSize[];
  arrSizes: AirportSize[];
  sort: SearchQuery["sort"];
}

export const EMPTY_FILTERS: Filters = {
  regions: [],
  flightNumber: "",
  aircraft: [],
  airlines: [],
  dep: "",
  arr: "",
  minHours: "",
  maxHours: "",
  depSizes: [],
  arrSizes: [],
  sort: "recommended",
};

const hoursToMinutes = (value: string): number | null => {
  const hours = Number.parseFloat(value);
  return Number.isFinite(hours) && hours >= 0 ? Math.round(hours * 60) : null;
};

export function toSearchParams(f: Filters): URLSearchParams {
  const params = new URLSearchParams();
  f.regions.forEach((r) => params.append("region", r));
  if (f.flightNumber.trim()) params.set("flightNumber", f.flightNumber.trim());
  f.aircraft.forEach((a) => params.append("aircraft", a));
  f.airlines.forEach((a) => params.append("airline", a));
  if (f.dep.trim()) params.set("dep", f.dep.trim());
  if (f.arr.trim()) params.set("arr", f.arr.trim());
  const min = hoursToMinutes(f.minHours);
  const max = hoursToMinutes(f.maxHours);
  if (min !== null) params.set("minDuration", String(min));
  if (max !== null) params.set("maxDuration", String(max));
  f.depSizes.forEach((s) => params.append("depSize", s));
  f.arrSizes.forEach((s) => params.append("arrSize", s));
  params.set("sort", f.sort);
  return params;
}

export const formatDuration = (minutes: number) =>
  `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
