"use client";

import { useMemo } from "react";
import { EMPTY_FILTERS, type Filters } from "@/lib/filters";
import { AIRPORT_SIZES, type AirportSize, type OptionsResponse } from "@/lib/types";
import { AIRPORT_SIZE_INFO } from "@/lib/airport-sizes";
import { AirportInput } from "./AirportInput";
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
      <div className={styles.sizeGrid}>
        <button
          type="button"
          aria-pressed={value.length === 0}
          className={styles.toggle}
          onClick={() => onChange([])}
        >
          <span className={styles.sizeName}>Any size</span>
          <span className={styles.sizeHint}>No restriction</span>
        </button>
        {AIRPORT_SIZES.map((size) => {
          const on = value.includes(size);
          const info = AIRPORT_SIZE_INFO[size];
          return (
            <button
              key={size}
              type="button"
              aria-pressed={on}
              className={styles.toggle}
              data-size={size}
              onClick={() => onChange(on ? value.filter((s) => s !== size) : [...value, size])}
            >
              <span className={styles.sizeName}>{info.label}<span aria-hidden="true">{on ? "✓" : "+"}</span></span>
              <span className={styles.sizeHint}>{info.hint}</span>
            </button>
          );
        })}
      </div>
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
          <AirportInput
            label="Departure"
            placeholder="Code or city"
            value={filters.dep}
            airports={options?.airports ?? []}
            onChange={(v) => set("dep", v)}
          />
          <AirportInput
            label="Arrival"
            placeholder="Any"
            value={filters.arr}
            airports={options?.airports ?? []}
            onChange={(v) => set("arr", v)}
          />
        </div>
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
        <p className={styles.sizeIntro}>Choose one or more sizes for each end.</p>
        <SizeToggle label="Departure" value={filters.depSizes} onChange={(v) => set("depSizes", v)} />
        <SizeToggle label="Arrival" value={filters.arrSizes} onChange={(v) => set("arrSizes", v)} />
        <details className={styles.sizeGuide}>
          <summary>How sizes work</summary>
          <p>Estimated from airport category, scheduled airline service and runway infrastructure—not live traffic counts.</p>
          <p>Super Large airports have scheduled service and at least two paved runways of 9,000 ft (2,743 m). Large covers other major airports. Medium covers regional airports and smaller airline airports with runways of at least 5,000 ft (1,524 m).</p>
          <p>Below the major-airport tier, runways under 5,000 ft indicate Small; under 3,000 ft (914 m), Mini. Missing runway data falls back to the airport category. Results depend on available schedules.</p>
        </details>
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

      <Section n="06" title="Flight number">
        <label className={styles.field}>
          <span>Full or partial number</span>
          <input
            type="text"
            value={filters.flightNumber}
            placeholder="e.g. BA123 or 123"
            onChange={(e) => set("flightNumber", e.target.value)}
            className={styles.codeInput}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </Section>
    </form>
  );
}
