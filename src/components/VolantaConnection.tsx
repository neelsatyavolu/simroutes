"use client";

import { useEffect, useRef, useState } from "react";
import { getJson, sendJson } from "@/lib/http";
import type { VolantaConnectionResponse, VolantaSyncResponse } from "@/lib/types";
import styles from "@/components/LogbookPanel.module.css";

const ENDPOINT = "/api/logbook/volanta";

export function VolantaConnection({ disabled, onBusyChange, onChanged }: {
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onChanged: () => void;
}) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [twoFactor, setTwoFactor] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const active = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getJson<VolantaConnectionResponse>(ENDPOINT, controller.signal)
      .then((r) => setConnected(r.connected))
      .catch((e: Error) => {
        if (e.name !== "AbortError") { setConnected(false); setError(true); setMessage(e.message); }
      });
    return () => { controller.abort(); active.current?.abort(); };
  }, []);

  async function sync(signal: AbortSignal) {
    let page: number | null = 1;
    let added = 0;
    let duplicates = 0;
    let skipped = 0;
    const warnings = new Set<string>();
    try {
      while (page !== null) {
        setMessage(`Importing flight history · page ${page} · ${added} added`);
        const result: VolantaSyncResponse = await sendJson(`${ENDPOINT}/sync?page=${page}`, { method: "POST", signal });
        added += result.added;
        duplicates += result.duplicates;
        skipped += result.skipped;
        result.errors.forEach((warning) => warnings.size < 20 && warnings.add(warning));
        page = result.nextPage;
      }
      setMessage(`Imported ${added} flights · ${duplicates} already in your logbook${skipped ? ` · ${skipped} incomplete or missing airports` : ""}${warnings.size ? `. ${[...warnings].join(". ")}` : ""}`);
      setError(warnings.size > 0);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(true);
        setMessage(`${added} flights imported before stopping. ${(e as Error).message} Imported flights are kept; retrying skips duplicates.`);
        const status = await getJson<VolantaConnectionResponse>(ENDPOINT, signal).catch(() => null);
        if (status) setConnected(status.connected);
      }
    } finally {
      if (!signal.aborted) onChanged();
    }
  }

  async function run(form?: HTMLFormElement) {
    const controller = new AbortController();
    active.current = controller;
    onBusyChange(true);
    setError(false);
    setMessage(form ? "Connecting to Volanta…" : "Starting import…");
    try {
      if (form) {
        const fields = new FormData(form);
        const code = String(fields.get("twoFactorCode") ?? "").trim();
        const result = await sendJson<VolantaConnectionResponse>(ENDPOINT, {
          method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({ username: fields.get("username"), password: fields.get("password"), ...(code && { twoFactorCode: code }) }),
        });
        if (result.twoFactorRequired) {
          setTwoFactor(true);
          setMessage("Enter the current six-digit code from your authenticator, then connect again.");
          return;
        }
        form.reset();
        setConnected(true);
        setTwoFactor(false);
      }
      await sync(controller.signal);
    } catch (e) {
      form?.reset();
      if ((e as Error).name !== "AbortError") { setError(true); setMessage((e as Error).message); }
    } finally {
      onBusyChange(false);
    }
  }

  async function disconnect() {
    onBusyChange(true);
    try {
      await sendJson(ENDPOINT, { method: "DELETE" });
      setConnected(false);
      setTwoFactor(false);
      setError(false);
      setMessage("Disconnected. Your imported flights remain in your logbook.");
    } catch (e) { setError(true); setMessage((e as Error).message); }
    finally { onBusyChange(false); }
  }

  return (
    <div className={styles.volanta}>
      <p className={styles.dropTitle}>Connect Volanta</p>
      <p className={styles.hint}>Import completed flights. Up to 10,000 flights.</p>
      {connected ? (
        <>
          <p className={styles.hint}>Connected on this browser for up to one hour.</p>
          <div className={styles.row}>
            <button className={styles.button} disabled={disabled} onClick={() => void run()}>Sync flight history</button>
            <button className={styles.link} disabled={disabled} onClick={() => void disconnect()}>Disconnect</button>
          </div>
        </>
      ) : (
        <form className={styles.accountForm} onSubmit={(e) => { e.preventDefault(); void run(e.currentTarget); }}>
          <label htmlFor="volanta-account-user">Username or email</label>
          <div className={styles.row}><input id="volanta-account-user" name="username" autoComplete="username" required maxLength={254} disabled={disabled} /></div>
          <label htmlFor="volanta-account-password">Password</label>
          <div className={styles.row}><input id="volanta-account-password" name="password" type="password" autoComplete="current-password" required maxLength={1024} disabled={disabled} /></div>
          <label htmlFor="volanta-account-code">Authenticator code {twoFactor ? "(required)" : "(if enabled)"}</label>
          <div className={styles.row}><input id="volanta-account-code" name="twoFactorCode" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required={twoFactor} disabled={disabled} /></div>
          <p className={styles.hint}>Your password and code are used only to sign in, never saved. This uses Volanta’s app API and may need reconnecting if it changes.</p>
          <button className={styles.button} disabled={disabled || connected === null} type="submit">{disabled ? "Working…" : "Connect & import history"}</button>
        </form>
      )}
      {message && <p className={styles.hint} role={error ? "alert" : "status"}>{message}</p>}
    </div>
  );
}
