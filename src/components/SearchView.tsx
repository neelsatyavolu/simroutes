"use client";

import { useEffect, useState } from "react";
import { EMPTY_FILTERS, toSearchParams, type Filters } from "@/lib/filters";
import { getJson } from "@/lib/http";
import type { OptionsResponse, SearchQuery, SearchResponse } from "@/lib/types";
import { FilterPanel } from "./FilterPanel";
import { FlightStrip } from "./FlightStrip";
import { PlanButton } from "./PlanButton";
import shared from "./shared.module.css";
import styles from "./SearchView.module.css";

const DEBOUNCE_MS = 250;

type Status = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; data: SearchResponse };

const SORTS: { value: SearchQuery["sort"]; label: string }[] = [
  { value: "duration", label: "Block time" },
  { value: "departure", label: "Departure" },
  { value: "airline", label: "Airline" },
];

export function SearchView({ options }: { options: OptionsResponse | null }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [status, setStatus] = useState<Status>({ kind: "loading" });

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

  return (
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
          <div className={shared.empty}>
            <h2>No schedule data yet</h2>
            <p>Schedules refresh weekly. Check back soon.</p>
          </div>
        ) : status.kind === "error" ? (
          <div className={shared.empty} role="alert">
            <h2>Something went wrong</h2>
            <p>{status.message}</p>
          </div>
        ) : status.kind === "ready" && status.data.total === 0 ? (
          <div className={shared.empty}>
            <h2>No routes match</h2>
            <p>Widen the block time or remove an aircraft or airport filter.</p>
          </div>
        ) : status.kind === "ready" ? (
          <ol className={shared.list}>
            {status.data.results.map((f, i) => <FlightStrip key={f.id} flight={f} index={i} action={<PlanButton flight={f} />} />)}
          </ol>
        ) : null}
      </main>
    </div>
  );
}
