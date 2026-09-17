"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { formatDuration } from "@/lib/filters";
import { getJson } from "@/lib/http";
import type { LogbookFlightView, LogbookResponse, SuggestionRowView, SuggestionsResponse } from "@/lib/types";
import { FlightStrip } from "./FlightStrip";
import { LogbookPanel } from "./LogbookPanel";
import shared from "./shared.module.css";
import styles from "./ForYou.module.css";

const RELAXED_TEXT: Record<"aircraft" | "duration", string> = {
  aircraft: "any aircraft",
  duration: "any length",
};

function Row({ title, subtitle, row, emptyText }: { title: string; subtitle?: string; row: SuggestionRowView; emptyText: string }) {
  return (
    <section className={styles.row}>
      <header className={styles.rowHeader}>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {row.relaxed.length > 0 && row.results.length > 0 && (
        <p className={styles.relaxed}>
          Nothing matched your usual flying here, so these include {row.relaxed.map((r) => RELAXED_TEXT[r]).join(" and ")}.
        </p>
      )}
      {row.results.length === 0 ? (
        <p className={styles.rowEmpty}>{emptyText}</p>
      ) : (
        <ol className={shared.list}>
          {row.results.map((f, i) => <FlightStrip key={f.id} flight={f} index={i} />)}
        </ol>
      )}
    </section>
  );
}

function SignedOut({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className={styles.hero}>
      <p className={styles.heroKicker}>Flights picked for you</p>
      <h2>Your next leg, chosen from how you actually fly</h2>
      <p>
        Import your logbook from Volanta or a CSV and SimRoutes suggests real scheduled flights in the aircraft you fly,
        at the lengths you like: continuing from where you last landed, or somewhere new.
      </p>
      <div className={styles.heroActions}>
        <SignInButton mode="modal">
          <button type="button" className={styles.primary}>Sign in to get suggestions</button>
        </SignInButton>
        <button type="button" className={styles.secondary} onClick={onBrowse}>Browse all routes</button>
      </div>
    </div>
  );
}

export function ForYou({ onBrowse }: { onBrowse: () => void }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [suggestions, setSuggestions] = useState<SuggestionsResponse | null>(null);
  const [logbook, setLogbook] = useState<LogbookFlightView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([getJson<SuggestionsResponse>("/api/suggestions"), getJson<LogbookResponse>("/api/logbook")])
      .then(([s, l]) => {
        setError(null);
        setSuggestions(s);
        setLogbook(l.flights);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (isSignedIn) load();
  }, [isSignedIn, load]);

  if (!isLoaded) return <p className={styles.loading}>Loading…</p>;
  if (!isSignedIn) return <SignedOut onBrowse={onBrowse} />;

  const profile = suggestions?.profile;
  const last = profile?.lastArrival;
  const lastLabel = last ? ("name" in last ? `${last.city || last.name} (${last.icao})` : last.icao) : "";

  return (
    <div className={styles.layout}>
      <main className={styles.main} aria-live="polite">
        {error ? (
          <div className={shared.empty} role="alert">
            <h2>Couldn&apos;t load suggestions</h2>
            <p>{error}</p>
          </div>
        ) : !suggestions ? (
          <p className={styles.loading}>Finding flights for you…</p>
        ) : !profile ? (
          <div className={shared.empty}>
            <h2>Import your flights to start</h2>
            <p>Add your Volanta username or upload a logbook CSV. Suggestions appear here straight away.</p>
          </div>
        ) : (
          <>
            <dl className={styles.profile}>
              <div><dt>Flying</dt><dd>{profile.aircraft.length ? profile.aircraft.join(" · ") : "—"}</dd></div>
              <div><dt>Typical block</dt><dd>{profile.duration ? `${formatDuration(profile.duration.min)}–${formatDuration(profile.duration.max)}` : "—"}</dd></div>
              <div><dt>Last landed</dt><dd>{last?.icao ?? "—"}</dd></div>
              <div><dt>Logged</dt><dd>{profile.flightCount} flights · {profile.visitedCount} airports</dd></div>
            </dl>
            {suggestions.continueFrom && (
              <Row
                title={`Continue from ${lastLabel}`}
                subtitle="Your next leg from where you last landed"
                row={suggestions.continueFrom}
                emptyText={`No scheduled departures from ${last?.icao} in this week's data. Try "New for you" below or Search.`}
              />
            )}
            {suggestions.discover && (
              <Row
                title="New for you"
                subtitle="Destinations you haven't flown yet, in aircraft you fly"
                row={suggestions.discover}
                emptyText="No new destinations match yet. Import more flights or browse Search."
              />
            )}
          </>
        )}
      </main>
      <aside>
        <LogbookPanel flights={logbook} onChanged={load} />
      </aside>
    </div>
  );
}
