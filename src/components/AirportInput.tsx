"use client";

import { useId, useMemo, useState } from "react";
import { rankAirports, type AirportOption } from "@/lib/airport-search";
import listStyles from "./MultiSelect.module.css";
import styles from "./AirportInput.module.css";

interface Props {
  label: string;
  placeholder: string;
  value: string;
  airports: readonly AirportOption[];
  onChange: (code: string) => void;
}

const MAX_SUGGESTIONS = 8;

export function AirportInput({ label, placeholder, value, airports, onChange }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Free text while typing (e.g. "london"); only a real airport code is committed to the filter.
  const [text, setText] = useState(value);
  const [committed, setCommitted] = useState(value);
  if (value !== committed) {
    // The filter changed from outside (e.g. "Clear all"): show it.
    setCommitted(value);
    setText(value);
  }

  const matches = useMemo(() => rankAirports(airports, text, MAX_SUGGESTIONS), [airports, text]);
  const showList = open && matches.length > 0 && matches[0].icao !== text;

  const commit = (code: string) => {
    setCommitted(code);
    setText(code);
    onChange(code);
  };

  const pick = (a: AirportOption) => {
    commit(a.icao);
    setOpen(false);
  };

  const onTextChange = (next: string) => {
    setText(next);
    setOpen(true);
    setActive(0);
    const code = next.trim().toUpperCase();
    const exact = airports.find((a) => a.icao === code || a.iata === code);
    if (!code) commit("");
    else if (exact) {
      setCommitted(exact.icao);
      onChange(exact.icao);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (matches[active]) {
        if (e.key === "Enter") e.preventDefault();
        pick(matches[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={styles.root}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <div className={styles.inputWrap}>
        <input
          id={id}
          className={styles.input}
          value={text}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          onChange={(e) => onTextChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setText(committed); // Drop unfinished text that never matched an airport.
          }}
          onKeyDown={onKeyDown}
        />
        {text && (
          <button type="button" className={styles.clear} aria-label={`Clear ${label}`} onMouseDown={(e) => e.preventDefault()} onClick={() => commit("")}>
            ×
          </button>
        )}
      </div>
      {showList && (
        <ul id={`${id}-list`} role="listbox" className={`${listStyles.list} ${styles.list}`}>
          {matches.map((a, i) => (
            <li
              key={a.icao}
              role="option"
              aria-selected={i === active}
              className={styles.option}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(a);
              }}
            >
              <span className={styles.codes}>
                <span className={styles.icao}>{a.icao}</span>
                <span className={styles.iata}>{a.iata}</span>
              </span>
              <span className={styles.place}>
                <span className={styles.name}>{a.name}</span>
                <span className={styles.city}>{[a.city, a.country].filter(Boolean).join(", ")}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
