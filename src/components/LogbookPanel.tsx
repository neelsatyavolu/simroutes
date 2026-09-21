"use client";

import { useRef, useState } from "react";
import { VolantaConnection } from "@/components/VolantaConnection";
import { formatDuration } from "@/lib/filters";
import { sendJson } from "@/lib/http";
import type { ImportResponse, LogbookFlightView } from "@/lib/types";
import styles from "./LogbookPanel.module.css";

interface Props {
  flights: LogbookFlightView[] | null;
  /** Called after any change so suggestions and the list reload. */
  onChanged: () => void;
}

type Notice = { tone: "ok" | "error"; text: string; details?: string[] } | null;

const PREVIEW_COUNT = 8;

const summarize = (r: ImportResponse): Notice => ({
  tone: r.added > 0 ? "ok" : "error",
  text:
    r.added > 0
      ? `Added ${r.added} flight${r.added === 1 ? "" : "s"}${r.duplicates ? ` · ${r.duplicates} already in your logbook` : ""}`
      : r.duplicates
        ? `Nothing new: all ${r.duplicates} flights are already in your logbook`
        : "No flights could be imported",
  details: r.errors.length ? r.errors : undefined,
});

export function LogbookPanel({ flights, onChanged }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState<"csv" | "volanta" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [showAll, setShowAll] = useState(false);
  const [dragging, setDragging] = useState(false);

  const run = async (kind: "csv" | "volanta", action: () => Promise<ImportResponse>) => {
    setBusy(kind);
    setNotice(null);
    try {
      setNotice(summarize(await action()));
      onChanged();
    } catch (error) {
      setNotice({ tone: "error", text: (error as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const importFile = (file: File | undefined) => {
    if (!file) return;
    void run("csv", async () =>
      sendJson<ImportResponse>("/api/logbook/import/csv", {
        method: "POST",
        headers: { "content-type": "text/csv" },
        body: await file.text(),
      }),
    );
    if (fileInput.current) fileInput.current.value = "";
  };

  const importVolanta = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username.trim()) return;
    void run("volanta", () =>
      sendJson<ImportResponse>("/api/logbook/import/volanta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      }),
    );
  };

  const remove = async (id: string) => {
    try {
      await sendJson(`/api/logbook/${id}`, { method: "DELETE" });
      onChanged();
    } catch (error) {
      setNotice({ tone: "error", text: (error as Error).message });
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Delete every flight in your logbook? This can't be undone.")) return;
    try {
      await sendJson("/api/logbook", { method: "DELETE" });
      setNotice({ tone: "ok", text: "Logbook cleared" });
      onChanged();
    } catch (error) {
      setNotice({ tone: "error", text: (error as Error).message });
    }
  };

  const visible = showAll ? flights : flights?.slice(0, PREVIEW_COUNT);

  return (
    <section className={styles.panel} aria-labelledby="logbook-title">
      <div className={styles.header}>
        <h2 id="logbook-title">Your logbook</h2>
        <span className={styles.count}>{flights ? flights.length : "…"}</span>
      </div>

      <div className={styles.imports}>
        <VolantaConnection disabled={busy !== null} onBusyChange={(active) => setBusy(active ? "volanta" : null)} onChanged={onChanged} />
        <div
          className={styles.drop}
          data-dragging={dragging}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            importFile(e.dataTransfer.files[0]);
          }}
        >
          <p className={styles.dropTitle}>Upload a logbook CSV</p>
          <p className={styles.hint}>Little Navmap, ELEVATEX, or any CSV with origin, destination and aircraft columns</p>
          <button type="button" className={styles.button} disabled={busy !== null} onClick={() => fileInput.current?.click()}>
            {busy === "csv" ? "Importing…" : "Choose file"}
          </button>
          <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => importFile(e.target.files?.[0])} />
        </div>

        <form className={styles.volanta} onSubmit={importVolanta}>
          <label htmlFor="volanta-user">Volanta username</label>
          <div className={styles.row}>
            <input
              id="volanta-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your-username"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className={styles.button} disabled={busy !== null || !username.trim()}>
              {busy === "volanta" ? "Importing…" : "Import"}
            </button>
          </div>
          <p className={styles.hint}>Imports your 5 most recent public flights.</p>
        </form>
      </div>

      {notice && (
        <div className={styles.notice} data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>
          <p>{notice.text}</p>
          {notice.details && (
            <details>
              <summary>{notice.details.length} row{notice.details.length === 1 ? "" : "s"} skipped</summary>
              <ul>{notice.details.map((d) => <li key={d}>{d}</li>)}</ul>
            </details>
          )}
        </div>
      )}

      {flights && flights.length > 0 && (
        <>
          <ul className={styles.flights}>
            {visible?.map((f) => (
              <li key={f.id}>
                <span className={styles.route}>{f.depIcao}<span aria-hidden> → </span>{f.arrIcao}</span>
                <span className={styles.meta}>
                  {[f.aircraft, f.blockMinutes ? formatDuration(f.blockMinutes) : null, f.flownAt ? new Date(f.flownAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <button type="button" className={styles.remove} aria-label={`Remove ${f.depIcao} to ${f.arrIcao}`} onClick={() => remove(f.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.footer}>
            {flights.length > PREVIEW_COUNT && (
              <button type="button" className={styles.link} onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show fewer" : `Show all ${flights.length}`}
              </button>
            )}
            <button type="button" className={`${styles.link} ${styles.danger}`} onClick={clearAll}>
              Clear logbook
            </button>
          </div>
        </>
      )}
    </section>
  );
}
