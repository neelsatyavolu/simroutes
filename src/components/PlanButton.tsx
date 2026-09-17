"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useId, useRef, useState } from "react";
import { sendJson } from "@/lib/http";
import type { FlightResult } from "@/lib/types";
import styles from "./PlanButton.module.css";

const localDate = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function PlanButton({ flight }: { flight: FlightResult }) {
  const { isSignedIn } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [date, setDate] = useState(localDate(1));
  const [aircraft, setAircraft] = useState(flight.aircraft[0] ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plannedFor, setPlannedFor] = useState<string | null>(null);

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button type="button" className={styles.trigger}>Plan</button>
      </SignInButton>
    );
  }

  const save = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await sendJson("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plannedDate: date,
          flightNumber: flight.flightNumber,
          airline: { name: flight.airline.name, icao: flight.airline.icao, iata: flight.airline.iata },
          depIcao: flight.depIcao,
          arrIcao: flight.arrIcao,
          aircraft,
          depLocal: flight.depLocal,
          durationMin: flight.durationMin,
        }),
      });
      setPlannedFor(date);
      dialog.current?.close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        data-planned={plannedFor ? "true" : undefined}
        onClick={() => dialog.current?.showModal()}
        title={plannedFor ? `Planned for ${plannedFor}` : undefined}
      >
        {plannedFor ? "Planned ✓" : "Plan"}
      </button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <form onSubmit={save} className={styles.form}>
          <h2 id={`${id}-title`}>Plan {flight.flightNumber}</h2>
          <p className={styles.route}>
            {flight.depIcao} → {flight.arrIcao} · departs {flight.depLocal} local
          </p>
          <label>
            <span>Date</span>
            <input type="date" required min={localDate(0)} max={localDate(365)} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <span>Aircraft</span>
            <select value={aircraft} onChange={(e) => setAircraft(e.target.value)}>
              {flight.aircraft.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => dialog.current?.close()}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={saving}>{saving ? "Saving…" : "Add to planned"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
