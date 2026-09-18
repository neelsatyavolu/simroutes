"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { formatDuration } from "@/lib/filters";
import { getJson, sendJson } from "@/lib/http";
import { groupPlans } from "@/lib/planner/group";
import { simbriefDispatchUrl } from "@/lib/planner/simbrief";
import type { NavigraphStatus, Plan } from "@/lib/types";
import shared from "./shared.module.css";
import styles from "./PlannedView.module.css";

const NAVIGRAPH_NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  connected: { tone: "ok", text: "Navigraph connected. SimBrief flight plans can now be loaded." },
  denied: { tone: "error", text: "Navigraph sign-in was cancelled." },
  "invalid-state": { tone: "error", text: "Navigraph sign-in expired. Please try again." },
  failed: { tone: "error", text: "Couldn't connect Navigraph. Please try again." },
  "not-configured": { tone: "error", text: "Navigraph sign-in isn't available yet." },
  "signed-out": { tone: "error", text: "Sign in to SimRoutes before connecting Navigraph." },
};

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function dayLabel(date: string, today: string): string {
  const diff = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  const formatted = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return diff === 0 ? `Today · ${formatted}` : diff === 1 ? `Tomorrow · ${formatted}` : formatted;
}

function NavigraphCard({ status, onChanged }: { status: NavigraphStatus | null; onChanged: () => void }) {
  const disconnect = async () => {
    await sendJson("/api/navigraph", { method: "DELETE" });
    onChanged();
  };
  return (
    <section className={styles.navigraph}>
      <div>
        <h3>Navigraph</h3>
        {status?.alias ? (
          <p>Connected as <strong>{status.alias}</strong>. Load your latest SimBrief plan onto any flight.</p>
        ) : status?.configured ? (
          <p>Connect your Navigraph account to pull SimBrief flight plans into your planned flights.</p>
        ) : (
          <p>Navigraph sign-in is coming soon. You can still plan flights and open them in SimBrief.</p>
        )}
      </div>
      {status?.alias ? (
        <button type="button" className={styles.secondary} onClick={disconnect}>Disconnect</button>
      ) : (
        <a
          className={styles.primary}
          href="/api/navigraph/connect"
          aria-disabled={!status?.configured}
          onClick={(e) => !status?.configured && e.preventDefault()}
        >
          Connect Navigraph
        </a>
      )}
    </section>
  );
}

function PlanCard({ plan, canLoadOfp, onChanged }: { plan: Plan; canLoadOfp: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const json = { "content-type": "application/json" };
  const ofp = plan.ofp;

  return (
    <li className={styles.card} data-status={plan.status}>
      <div className={styles.cardMain}>
        <div className={styles.ident}>
          <span className={styles.time}>{plan.depLocal}</span>
          <span className={styles.flightNo}>{plan.flightNumber}</span>
          <span className={styles.airline}>{plan.airlineName}</span>
        </div>
        <div className={styles.route}>
          <span className={styles.icao}>{plan.depIcao}</span>
          <span className={styles.arrow} aria-hidden>→</span>
          <span className={styles.icao}>{plan.arrIcao}</span>
        </div>
        <div className={styles.facts}>
          <span>{plan.aircraft}</span>
          <span>{formatDuration(plan.blockMinutes)} block</span>
        </div>
      </div>

      {ofp && (
        <dl className={styles.ofp}>
          <div><dt>Route</dt><dd className={styles.ofpRoute}>{ofp.depRunway ? `${ofp.depIcao}/${ofp.depRunway} ` : ""}{ofp.route}{ofp.arrRunway ? ` ${ofp.arrIcao}/${ofp.arrRunway}` : ""}</dd></div>
          <div><dt>Cruise</dt><dd>{ofp.initialAltitudeFt ? `FL${Math.round(ofp.initialAltitudeFt / 100)}` : "—"}</dd></div>
          <div><dt>Block</dt><dd>{ofp.blockMinutes ? formatDuration(ofp.blockMinutes) : "—"}</dd></div>
          <div><dt>Ramp fuel</dt><dd>{ofp.rampFuel ? `${ofp.rampFuel.toLocaleString()} ${ofp.fuelUnits ?? ""}` : "—"}</dd></div>
          <div><dt>Alternate</dt><dd>{ofp.alternateIcao ?? "—"}</dd></div>
          {ofp.pdfUrl && <div><dt>Briefing</dt><dd><a href={ofp.pdfUrl} target="_blank" rel="noreferrer">PDF ↗</a></dd></div>}
        </dl>
      )}

      {plan.status === "planned" && (
        <div className={styles.actions}>
          <a className={styles.primary} href={simbriefDispatchUrl(plan)} target="_blank" rel="noreferrer">
            Plan in SimBrief ↗
          </a>
          <button
            type="button"
            className={styles.secondary}
            disabled={!canLoadOfp || busy !== null}
            title={canLoadOfp ? "Attach your latest SimBrief flight plan" : "Connect Navigraph to load SimBrief plans"}
            onClick={() => act("ofp", () => sendJson(`/api/plans/${plan.id}/ofp`, { method: "POST" }))}
          >
            {busy === "ofp" ? "Loading…" : ofp ? "Reload flight plan" : "Load flight plan"}
          </button>
          <label className={styles.reschedule}>
            <span className={styles.visuallyHidden}>Reschedule</span>
            <input
              type="date"
              value={plan.plannedDate}
              min={todayLocal()}
              onChange={(e) => e.target.value && act("date", () => sendJson(`/api/plans/${plan.id}`, { method: "PATCH", headers: json, body: JSON.stringify({ plannedDate: e.target.value }) }))}
            />
          </label>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy !== null}
            onClick={() => act("flown", () => sendJson(`/api/plans/${plan.id}`, { method: "PATCH", headers: json, body: JSON.stringify({ status: "flown" }) }))}
          >
            {busy === "flown" ? "Saving…" : "Mark flown"}
          </button>
          <button
            type="button"
            className={styles.remove}
            aria-label={`Remove ${plan.flightNumber}`}
            disabled={busy !== null}
            onClick={() => act("delete", () => sendJson(`/api/plans/${plan.id}`, { method: "DELETE" }))}
          >
            Remove
          </button>
        </div>
      )}
      {plan.status === "flown" && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy !== null}
            onClick={() => act("unflown", () => sendJson(`/api/plans/${plan.id}`, { method: "PATCH", headers: json, body: JSON.stringify({ status: "planned" }) }))}
          >
            {busy === "unflown" ? "Saving…" : "Mark unflown"}
          </button>
        </div>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </li>
  );
}

export function PlannedView({ navigraphOutcome, onFindFlights }: { navigraphOutcome: string | null; onFindFlights: () => void }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [status, setStatus] = useState<NavigraphStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFlown, setShowFlown] = useState(false);

  const load = useCallback(() => {
    Promise.all([getJson<{ plans: Plan[] }>("/api/plans"), getJson<NavigraphStatus>("/api/navigraph")])
      .then(([p, s]) => {
        setError(null);
        setPlans(p.plans);
        setStatus(s);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (isSignedIn) load();
  }, [isSignedIn, load]);

  if (!isLoaded) return <p className={styles.muted}>Loading…</p>;
  if (!isSignedIn) {
    return (
      <div className={shared.empty}>
        <h2>Plan your upcoming flights</h2>
        <p>Sign in to schedule flights for specific dates and send them to SimBrief.</p>
        <SignInButton mode="modal">
          <button type="button" className={styles.primary} style={{ marginTop: 16 }}>Sign in</button>
        </SignInButton>
      </div>
    );
  }

  const today = todayLocal();
  const groups = plans ? groupPlans(plans, today) : null;
  const notice = navigraphOutcome ? NAVIGRAPH_NOTICES[navigraphOutcome] : undefined;
  const canLoadOfp = Boolean(status?.alias);

  return (
    <div className={styles.view}>
      {notice && <p className={styles.notice} data-tone={notice.tone} role="status">{notice.text}</p>}
      <NavigraphCard status={status} onChanged={load} />

      {error ? (
        <div className={shared.empty} role="alert"><h2>Couldn&apos;t load your plans</h2><p>{error}</p></div>
      ) : !groups ? (
        <p className={styles.muted}>Loading your plans…</p>
      ) : groups.upcoming.length === 0 && groups.overdue.length === 0 ? (
        <div className={shared.empty}>
          <h2>No upcoming flights</h2>
          <p>Press &ldquo;Plan&rdquo; on any flight in For you or Search to schedule it.</p>
          <button type="button" className={styles.secondary} style={{ marginTop: 16 }} onClick={onFindFlights}>Find a flight</button>
        </div>
      ) : (
        <>
          {groups.overdue.length > 0 && (
            <section className={styles.day}>
              <h2 className={styles.overdue}>Not flown yet</h2>
              <ol className={styles.cards}>{groups.overdue.map((p) => <PlanCard key={p.id} plan={p} canLoadOfp={canLoadOfp} onChanged={load} />)}</ol>
            </section>
          )}
          {groups.upcoming.map((g) => (
            <section key={g.date} className={styles.day}>
              <h2>{dayLabel(g.date, today)}</h2>
              <ol className={styles.cards}>{g.plans.map((p) => <PlanCard key={p.id} plan={p} canLoadOfp={canLoadOfp} onChanged={load} />)}</ol>
            </section>
          ))}
        </>
      )}

      {groups && groups.flown.length > 0 && (
        <section className={styles.day}>
          <button type="button" className={styles.toggle} onClick={() => setShowFlown(!showFlown)} aria-expanded={showFlown}>
            {showFlown ? "Hide" : "Show"} flown ({groups.flown.length})
          </button>
          {showFlown && <ol className={styles.cards}>{groups.flown.map((p) => <PlanCard key={p.id} plan={p} canLoadOfp={false} onChanged={load} />)}</ol>}
        </section>
      )}
    </div>
  );
}
