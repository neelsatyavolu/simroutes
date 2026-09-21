"use client";

import { useEffect, useState } from "react";
import { ForYou } from "@/components/ForYou";
import { EMPTY_FILTERS, toSearchParams, type Filters } from "@/lib/filters";
import { getJson } from "@/lib/http";
import { groupFlightsByRoute } from "@/lib/route-groups";
import type { OptionsResponse, SearchQuery, SearchResponse } from "@/lib/types";
import { FilterPanel } from "./FilterPanel";
import { RouteStrip } from "@/components/RouteStrip";
import shared from "./shared.module.css";
import styles from "./SearchView.module.css";

const DEBOUNCE_MS = 250;

type Status = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; data: SearchResponse };

const SORTS: { value: SearchQuery["sort"]; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "duration", label: "Block time" },
  { value: "departure", label: "Departure" },
  { value: "airline", label: "Airline" },
];

export function SearchView({ options }: { options: OptionsResponse | null }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showForYou, setShowForYou] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  function changeFilters(next: Filters) {
    setShowForYou(false);
    setFilters(next);
  }

  useEffect(() => {
    if (showForYou) return;
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
  }, [filters, showForYou]);

  const noData = options !== null && options.flightCount === 0;
  const groups = status.kind === "ready" ? groupFlightsByRoute(status.data.results) : [];

  return (
    <div className={styles.layout}>
      <aside>
        <FilterPanel filters={filters} options={options} onChange={changeFilters} />
      </aside>

      <main className={styles.results} aria-live="polite">
        <div className={styles.toolbar}>
          <p className={styles.count}>
            {showForYou ? "Flights picked for you" : status.kind === "ready" ? (
              <>
                <strong>{status.data.total.toLocaleString()}</strong> {status.data.total === 1 ? "flight" : "flights"}
                <span> · {groups.length} {groups.length === 1 ? "route" : "routes"}{status.data.total > status.data.results.length ? ` in first ${status.data.results.length} flights` : ""}</span>
              </>
            ) : status.kind === "loading" ? "Searching…" : ""}
          </p>
          <div className={styles.sort} role="group" aria-label="Flight list and sort">
            <button type="button" aria-pressed={showForYou} onClick={() => {
              setFilters(EMPTY_FILTERS);
              setShowForYou(true);
            }}>
              For you
            </button>
            {SORTS.map((s) => (
              <button key={s.value} type="button" aria-pressed={!showForYou && filters.sort === s.value} onClick={() => changeFilters({ ...filters, sort: s.value })}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {noData ? (
          <div className={shared.empty}>
            <h2>No schedule data yet</h2>
            <p>Schedules refresh weekly. Check back soon.</p>
          </div>
        ) : showForYou ? (
          <ForYou embedded onBrowse={() => setShowForYou(false)} />
        ) : status.kind === "error" ? (
          <div className={shared.empty} role="alert">
            <h2>Something went wrong</h2>
            <p>{status.message}</p>
          </div>
        ) : status.kind === "ready" && status.data.total === 0 ? (
          <div className={shared.empty}>
            <h2>No routes match</h2>
            <p>Check the flight number, widen the block time, or remove a filter.</p>
          </div>
        ) : status.kind === "ready" ? (
          <ol className={shared.list}>
            {groups.map((group) => <RouteStrip key={group.id} group={group} />)}
          </ol>
        ) : null}
      </main>
    </div>
  );
}
