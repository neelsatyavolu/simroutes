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

const REPO_URL = "https://github.com/neelsatyavolu/simroutes";

const isTab =(value: string | null): value is Tab => TABS.some((t) => t.id === value);

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
            <a
              className={styles.github}
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                />
              </svg>
              GitHub
            </a>
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
