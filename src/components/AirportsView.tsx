"use client";

import { useEffect, useState } from "react";
import { AIRPORT_SIZE_INFO } from "@/lib/airport-sizes";
import { getJson } from "@/lib/http";
import { SCENERY_SOURCE } from "@/lib/scenery";
import type { Airport, AirportsResponse, SceneryResponse } from "@/lib/types";
import styles from "@/components/AirportsView.module.css";

const compatibilityLabels = { native: "Native MSFS 2024", compatible: "MSFS 2024 compatible", tested: "Tested in MSFS 2024" };

function SceneryResults({ airport }: { airport: Airport }) {
  const [data, setData] = useState<SceneryResponse | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getJson<SceneryResponse>(`/api/airports/${encodeURIComponent(airport.icao)}/scenery`, controller.signal)
      .then(setData)
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not load scenery listings. Try again or check the source list.");
      });
    return () => controller.abort();
  }, [airport.icao, attempt]);

  return (
    <section className={styles.detail} aria-label={`Scenery for ${airport.icao}`}>
      <div className={styles.airportHeader}>
        <span className={styles.code}>{airport.icao}</span>
        <span>{airport.iata}</span>
        <span className={styles.badge}>{AIRPORT_SIZE_INFO[airport.size].label}</span>
      </div>
      <h2>{airport.name}</h2>
      <p className={styles.muted}>{[airport.city, airport.country].filter(Boolean).join(", ")}</p>
      <div className={styles.sectionHeading}>
        <h3>Find your scenery</h3>
        <span className={styles.badge}>MSFS 2024</span>
      </div>
      <p className={styles.muted}>Exact airport matches, with native releases first, then compatible and tested releases. Compatibility labels come from SceneryAddons; they are not quality ratings.</p>
      {!data && !error && <p role="status">Checking MSFS 2024 scenery…</p>}
      {error && <div role="alert"><p>{error}</p><button className={styles.retry} type="button" onClick={() => { setError(""); setAttempt((n) => n + 1); }}>Try again</button></div>}
      {data && data.results.length === 0 && <p className={styles.empty}>No MSFS 2024-compatible listing found for {airport.icao} in this index. Scenery may exist elsewhere or use a different airport code.</p>}
      {data && <div className={styles.sceneryList}>{data.results.map((entry) => (
        <article className={styles.scenery} key={entry.url}>
          <div className={styles.tags}>
            {data.recommendedUrl === entry.url && <span className={styles.best}>Best compatibility match</span>}
            <span className={styles.badge}>{compatibilityLabels[entry.compatibility]}</span>
          </div>
          <p className={styles.developer}>{entry.developer}</p>
          <h4>{entry.title}</h4>
          {entry.important && <p className={styles.notice}>The source flags important installation or compatibility notes. Read them before choosing this scenery.</p>}
          <a href={entry.url} target="_blank" rel="noopener noreferrer">View on SceneryAddons ↗</a>
        </article>
      ))}</div>}
      <p className={styles.source}><a href={SCENERY_SOURCE} target="_blank" rel="noopener noreferrer">SceneryAddons MSFS 2024 compatibility list ↗</a> · Refreshed hourly</p>
    </section>
  );
}

export function AirportsView() {
  const [query, setQuery] = useState("");
  const [airports, setAirports] = useState<Airport[]>([]);
  const [selected, setSelected] = useState<Airport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      getJson<AirportsResponse>(`/api/airports?q=${encodeURIComponent(query)}`, controller.signal)
        .then((data) => { if (!controller.signal.aborted) setAirports(data.airports); })
        .catch(() => { if (!controller.signal.aborted) setError("Could not search airports. Please try your search again."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  return (
    <div>
      <header className={styles.heading}>
        <p className={styles.kicker}>Airport directory · MSFS 2024</p>
        <h2>A better place to land.</h2>
        <p>Find an airport and discover scenery that fits your simulator.</p>
      </header>
      <div className={styles.layout}>
        <section className={styles.search} aria-label="Find an airport">
          <label htmlFor="airport-directory-search">Search airports</label>
          <input id="airport-directory-search" type="search" placeholder="ICAO, IATA, name or city" value={query} maxLength={100} onChange={(event) => {
            setQuery(event.target.value); setAirports([]); setLoading(Boolean(event.target.value.trim())); setError("");
          }} />
          <p className={styles.muted}>Search the full airport directory, including airports outside this week’s schedules.</p>
          <div role="status">
            {loading ? "Searching airports…" : error || (!query.trim() ? "Try KJFK, LHR or Tokyo." : airports.length ? `${airports.length === 30 ? "Top " : ""}${airports.length} matches` : "No matching airports. Try another code or name.")}
          </div>
          <ul className={styles.airports}>{airports.map((airport) => (
            <li key={airport.icao}>
              <button type="button" aria-pressed={selected?.icao === airport.icao} onClick={() => setSelected(airport)}>
                <span className={styles.resultCodes}>{airport.icao} <small>{airport.iata}</small></span>
                <strong>{airport.name}</strong>
                <span className={styles.muted}>{[airport.city, airport.country].filter(Boolean).join(", ")}</span>
              </button>
            </li>
          ))}</ul>
        </section>
        {selected ? <SceneryResults key={selected.icao} airport={selected} /> : (
          <section className={styles.placeholder}>
            <span className={styles.kicker}>Your next destination</span>
            <h3>Start with an airport.</h3>
            <p>Select a search result to compare MSFS 2024 scenery, developers and compatibility.</p>
          </section>
        )}
      </div>
    </div>
  );
}
