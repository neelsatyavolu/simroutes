import { formatDuration } from "@/lib/filters";
import type { Airport, FlightResult } from "@/lib/types";
import styles from "./FlightStrip.module.css";

const SIZE_LABEL: Record<Airport["size"], string> = { large: "L", medium: "M", small: "S" };

function AirportCell({ icao, airport, time, side }: { icao: string; airport: Airport | null; time: string; side: "dep" | "arr" }) {
  return (
    <div className={styles.airport} data-side={side}>
      <div className={styles.codeRow}>
        <span className={styles.icao}>{icao}</span>
        {airport?.iata && <span className={styles.iata}>{airport.iata}</span>}
        {airport && (
          <span className={styles.size} data-size={airport.size} title={`${airport.size} airport`}>
            {SIZE_LABEL[airport.size]}
          </span>
        )}
      </div>
      <div className={styles.name} title={airport?.name}>
        {airport ? `${airport.city || airport.name}, ${airport.country}` : "Unknown airport"}
      </div>
      <div className={styles.time}>{time} <span>LT</span></div>
    </div>
  );
}

export function FlightStrip({ flight, index }: { flight: FlightResult; index: number }) {
  return (
    <li className={styles.strip} style={{ animationDelay: `${Math.min(index, 20) * 25}ms` }}>
      <div className={styles.ident}>
        <span className={styles.flightNo}>{flight.flightNumber}</span>
        <span className={styles.airline}>{flight.airline.name}</span>
      </div>
      <div className={styles.type}>{flight.aircraft}</div>
      <AirportCell side="dep" icao={flight.depIcao} airport={flight.dep} time={flight.depLocal} />
      <div className={styles.arrow} aria-hidden>
        <svg viewBox="0 0 40 10" width="40" height="10">
          <path d="M0 5h34M30 1l5 4-5 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      <AirportCell side="arr" icao={flight.arrIcao} airport={flight.arr} time={flight.arrLocal} />
      <div className={styles.block}>
        <span className={styles.blockLabel}>Block</span>
        <span className={styles.blockTime}>{formatDuration(flight.durationMin)}</span>
      </div>
    </li>
  );
}
