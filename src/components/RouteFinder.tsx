"use client";

import { useEffect, useState } from "react";
import { EMPTY_FILTERS, toSearchParams, type Filters } from "@/lib/filters";
import type { OptionsResponse, SearchQuery, SearchResponse } from "@/lib/types";
import { FilterPanel } from "./FilterPanel";
import { FlightStrip } from "./FlightStrip";
import styles from "./RouteFinder.module.css";

const DEBOUNCE_MS = 250;

type Status = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; data: SearchResponse };

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

const SORTS: { value: SearchQuery["sort"]; label: string }[] = [
  { value: "duration", label: "Block time" },
  { value: "departure", label: "Departure" },
  { value: "airline", label: "Airline" },
];

export function RouteFinder() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    getJson<OptionsResponse>("/api/options")
      .then(setOptions)
      .catch((e: Error) => setStatus({ kind: "error", message: e.message }));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus((s) => (s.kind === "ready" ? s : { kind: "loading" }));
      getJson<SearchResponse>(`/api/search?${toSearchParams(filters)}`, controller.signal)
        .then((data) => setStatus({ kind: "ready", data }))
        .catch((e: Error) => {
          if (e.name !== "AbortError") setStatus({ kind: "error", message: e.message });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters]);

  const noData = options !== null && options.flightCount === 0;
  const updated = options?.updatedAt
    ? new Date(options.updatedAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.kicker}>Real-world schedules · for your sim</p>
          <h1 className={styles.title}>
            Sim<span>Routes</span>
          </h1>
        </div>
        <dl className={styles.stats}>
          <div><dt>Flights</dt><dd>{options ? options.flightCount.toLocaleString() : "—"}</dd></div>
          <div><dt>Types</dt><dd>{options ? options.aircraft.length : "—"}</dd></div>
          <div><dt>Updated</dt><dd>{updated ?? "—"}</dd></div>
        </dl>
      </header>

      <div className={styles.layout}>
        <aside>
          <FilterPanel filters={filters} options={options} onChange={setFilters} />
        </aside>

        <main className={styles.results} aria-live="polite">
          <div className={styles.toolbar}>
            <p className={styles.count}>
              {status.kind === "ready" ? (
                <>
                  <strong>{status.data.total.toLocaleString()}</strong> {status.data.total === 1 ? "flight" : "flights"}
                  {status.data.total > status.data.results.length && <span> · showing {status.data.results.length}</span>}
                </>
              ) : status.kind === "loading" ? "Searching…" : ""}
            </p>
            <div className={styles.sort} role="group" aria-label="Sort by">
              {SORTS.map((s) => (
                <button key={s.value} type="button" aria-pressed={filters.sort === s.value} onClick={() => setFilters({ ...filters, sort: s.value })}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {noData ? (
            <div className={styles.empty}>
              <h2>No schedule data yet</h2>
              <p>Pull real departures from AeroDataBox, then refresh:</p>
              <pre>npm run data:flights</pre>
            </div>
          ) : status.kind === "error" ? (
            <div className={styles.empty} role="alert">
              <h2>Something went wrong</h2>
              <p>{status.message}</p>
            </div>
          ) : status.kind === "ready" && status.data.total === 0 ? (
            <div className={styles.empty}>
              <h2>No routes match</h2>
              <p>Widen the block time or remove an aircraft or airport filter.</p>
            </div>
          ) : status.kind === "ready" ? (
            <ol className={styles.list}>
              {status.data.results.map((f, i) => <FlightStrip key={f.id} flight={f} index={i} />)}
            </ol>
          ) : null}
        </main>
      </div>

      <footer className={styles.footer}>
        Schedules: AeroDataBox · Airports: OurAirports · Not for real-world navigation
      </footer>
    </div>
  );
}
