"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { getJson } from "@/lib/http";
import type { OptionsResponse } from "@/lib/types";
import { ForYou } from "./ForYou";
import { PlannedView } from "./PlannedView";
import { Logo } from "./Logo";
import { SearchView } from "./SearchView";
import { AirportsView } from "@/components/AirportsView";
import styles from "./AppShell.module.css";

type Tab = "for-you" | "search" | "airports" | "planned";

const TABS: { id: Tab; label: string }[] = [
  { id: "for-you", label: "For you" },
  { id: "search", label: "Search" },
  { id: "airports", label: "Airports" },
  { id: "planned", label: "Planned" },
];

const isTab = (value: string | null): value is Tab => TABS.some((t) => t.id === value);

export function AppShell() {
  const [tab, setTab] = useState<Tab>("for-you");
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [navigraphOutcome, setNavigraphOutcome] = useState<string | null>(null);

  useEffect(() => {
    getJson<OptionsResponse>("/api/options").then(setOptions).catch(() => setOptions(null));
    // Deep links such as the Navigraph callback: /?tab=planned&navigraph=connected
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab");
    if (isTab(requested) || params.has("navigraph")) {
      queueMicrotask(() => {
        if (isTab(requested)) setTab(requested);
        setNavigraphOutcome(params.get("navigraph"));
      });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const updated = options?.updatedAt
    ? new Date(options.updatedAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.kicker}>Real-world schedules · for your sim</p>
          <div className={styles.brand}>
            <Logo className={styles.logo} />
            <h1 className={styles.title}>
              Sim<span>Routes</span>
            </h1>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.account}>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button type="button" className={styles.signIn}>Sign in</button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
          <dl className={styles.stats}>
            <div><dt>Flights</dt><dd>{options ? options.flightCount.toLocaleString() : "—"}</dd></div>
            <div><dt>Types</dt><dd>{options ? options.aircraft.length : "—"}</dd></div>
            <div><dt>Updated</dt><dd>{updated ?? "—"}</dd></div>
          </dl>
        </div>
      </header>

      <nav className={styles.tabs} role="tablist" aria-label="Views">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={styles.tab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div role="tabpanel">
        {tab === "for-you" && <ForYou onBrowse={() => setTab("search")} />}
        {tab === "search" && <SearchView options={options} />}
        {tab === "airports" && <AirportsView />}
        {tab === "planned" && <PlannedView navigraphOutcome={navigraphOutcome} onFindFlights={() => setTab("for-you")} />}
      </div>

      <footer className={styles.footer}>
        Schedules: AeroDataBox · Airports: OurAirports · Not for real-world navigation
      </footer>
    </div>
  );
}
