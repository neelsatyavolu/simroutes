"use client";

import { useMemo } from "react";
import { EMPTY_FILTERS, type Filters } from "@/lib/filters";
import { AIRPORT_SIZES, type AirportSize, type OptionsResponse } from "@/lib/types";
import { MultiSelect } from "./MultiSelect";
import styles from "./FilterPanel.module.css";

interface Props {
  filters: Filters;
  options: OptionsResponse | null;
  onChange: (next: Filters) => void;
}

const DURATION_PRESETS = [
  { label: "< 1h", min: "", max: "1" },
  { label: "1–3h", min: "1", max: "3" },
  { label: "3–6h", min: "3", max: "6" },
  { label: "6h +", min: "6", max: "" },
];

function SizeToggle({ label, value, onChange }: { label: string; value: AirportSize[]; onChange: (v: AirportSize[]) => void }) {
  return (
    <fieldset className={styles.sizes}>
      <legend>{label}</legend>
      {AIRPORT_SIZES.map((size) => {
        const on = value.includes(size);
        return (
          <button
            key={size}
            type="button"
            aria-pressed={on}
            className={styles.toggle}
            data-size={size}
            onClick={() => onChange(on ? value.filter((s) => s !== size) : [...value, size])}
          >
            {size}
          </button>
        );
      })}
    </fieldset>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <span className={styles.num}>{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function FilterPanel({ filters, options, onChange }: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });

  const aircraftOptions = useMemo(
    () => (options?.aircraft ?? []).map((a) => ({ value: a.model, label: a.model, hint: `${a.count}` })),
    [options],
  );
  const airlineOptions = useMemo(
    () => (options?.airlines ?? []).map((a) => ({ value: a.code, label: a.name, hint: a.code })),
    [options],
  );

  return (
    <form className={styles.panel} onSubmit={(e) => e.preventDefault()} aria-label="Route filters">
      <div className={styles.header}>
        <span>Flight plan</span>
        <button type="button" className={styles.reset} onClick={() => onChange(EMPTY_FILTERS)}>
          Clear all
        </button>
      </div>

      <Section n="01" title="Aircraft">
        <MultiSelect
          label="Types"
          placeholder="e.g. Airbus A320, Boeing 787-9"
          options={aircraftOptions}
          selected={filters.aircraft}
          onChange={(v) => set("aircraft", v)}
        />
      </Section>

      <Section n="02" title="Airports">
        <div className={styles.pair}>
          {(["dep", "arr"] as const).map((key) => (
            <label key={key} className={styles.field}>
              <span>{key === "dep" ? "Departure" : "Arrival"}</span>
              <input
                list="airport-codes"
                value={filters[key]}
                maxLength={4}
                placeholder={key === "dep" ? "EGLL / LHR" : "Any"}
                onChange={(e) => set(key, e.target.value.toUpperCase())}
                className={styles.codeInput}
              />
            </label>
          ))}
        </div>
        <datalist id="airport-codes">
          {options?.airports.map((a) => (
            <option key={a.icao} value={a.icao}>{`${a.iata ? `${a.iata} · ` : ""}${a.name}`}</option>
          ))}
        </datalist>
      </Section>

      <Section n="03" title="Block time">
        <div className={styles.pair}>
          {(["minHours", "maxHours"] as const).map((key) => (
            <label key={key} className={styles.field}>
              <span>{key === "minHours" ? "Min hours" : "Max hours"}</span>
              <input
                type="number"
                min={0}
                max={24}
                step={0.25}
                inputMode="decimal"
                value={filters[key]}
                placeholder={key === "minHours" ? "0" : "∞"}
                onChange={(e) => set(key, e.target.value)}
                className={styles.codeInput}
              />
            </label>
          ))}
        </div>
        <div className={styles.presets}>
          {DURATION_PRESETS.map((p) => {
            const on = filters.minHours === p.min && filters.maxHours === p.max;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={on}
                className={styles.preset}
                onClick={() => onChange({ ...filters, minHours: on ? "" : p.min, maxHours: on ? "" : p.max })}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section n="04" title="Airport size">
        <SizeToggle label="Departure" value={filters.depSizes} onChange={(v) => set("depSizes", v)} />
        <SizeToggle label="Arrival" value={filters.arrSizes} onChange={(v) => set("arrSizes", v)} />
      </Section>

      <Section n="05" title="Airline">
        <MultiSelect
          label="Operators"
          placeholder="Any airline"
          options={airlineOptions}
          selected={filters.airlines}
          onChange={(v) => set("airlines", v)}
        />
      </Section>
    </form>
  );
}
