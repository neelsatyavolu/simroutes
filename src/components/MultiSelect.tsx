"use client";

import { useId, useMemo, useState } from "react";
import styles from "./MultiSelect.module.css";

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  label: string;
  placeholder: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
}

const MAX_VISIBLE = 40;

export function MultiSelect({ label, placeholder, options, selected, onChange }: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const labelOf = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => !selected.includes(o.value))
      .filter((o) => !q || o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
      .slice(0, MAX_VISIBLE);
  }, [options, selected, query]);

  const add = (value: string) => {
    onChange([...selected, value]);
    setQuery("");
    setActive(0);
  };
  const remove = (value: string) => onChange(selected.filter((v) => v !== value));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && matches[active]) {
      e.preventDefault();
      add(matches[active].value);
    } else if (e.key === "Backspace" && !query && selected.length) {
      remove(selected[selected.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={styles.root}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <div className={styles.field} data-open={open && matches.length > 0}>
        {selected.map((value) => (
          <button key={value} type="button" className={styles.chip} onClick={() => remove(value)} aria-label={`Remove ${labelOf.get(value) ?? value}`}>
            {labelOf.get(value) ?? value}
            <span aria-hidden>×</span>
          </button>
        ))}
        <input
          id={id}
          className={styles.input}
          value={query}
          placeholder={selected.length ? "" : placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
      </div>
      {open && matches.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className={styles.list}>
          {matches.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={i === active}
              className={styles.option}
              onMouseEnter={() => setActive(i)}
              // mousedown fires before the input's blur, so the click registers.
              onMouseDown={(e) => {
                e.preventDefault();
                add(o.value);
              }}
            >
              <span>{o.label}</span>
              {o.hint && <span className={styles.hint}>{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
