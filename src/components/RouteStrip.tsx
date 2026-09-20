import { PlanButton } from "@/components/PlanButton";
import { AIRPORT_SIZE_INFO } from "@/lib/airport-sizes";
import { formatDuration } from "@/lib/filters";
import type { RouteGroup } from "@/lib/route-groups";
import type { Airport } from "@/lib/types";
import styles from "@/components/RouteStrip.module.css";

function AirportLabel({ icao, airport }: { icao: string; airport: Airport | null }) {
  return (
    <span className={styles.airport}>
      <span className={styles.codes}>
        <strong>{icao}</strong>
        {airport?.iata && <small>{airport.iata}</small>}
        {airport && <span className={styles.size} title={`${AIRPORT_SIZE_INFO[airport.size].label} airport`}>
          {AIRPORT_SIZE_INFO[airport.size].badge}
        </span>}
      </span>
      <span className={styles.city} title={airport?.name}>
        {airport ? `${airport.city || airport.name}, ${airport.country}` : "Unknown airport"}
      </span>
    </span>
  );
}

export function RouteStrip({ group }: { group: RouteGroup }) {
  const flight = group.flights[0];
  const duration = formatDuration(group.minDuration);
  return (
    <li className={styles.strip}>
      <details className={styles.details}>
        <summary className={styles.summary}>
          <span className={styles.route}>
            <AirportLabel icao={flight.depIcao} airport={flight.dep} />
            <span className={styles.arrow} aria-hidden="true">→</span>
            <AirportLabel icao={flight.arrIcao} airport={flight.arr} />
          </span>
          <span className={styles.operators}>
            <span className={styles.airlines} title={group.airlines.join(" · ")}>{group.airlines.join(" · ")}</span>
            <span className={styles.departures}>
              {group.firstDeparture}{group.firstDeparture !== group.lastDeparture && `–${group.lastDeparture}`} <small>DEP LT</small>
            </span>
          </span>
          <span className={styles.block}>
            <small>Block</small>
            <span>{duration}{group.minDuration !== group.maxDuration && `–${formatDuration(group.maxDuration)}`}</span>
          </span>
          <span className={styles.expand}>
            <span>{group.flights.length} {group.flights.length === 1 ? "flight" : "flights"}</span>
            <span className={styles.chevron} aria-hidden="true">⌄</span>
          </span>
        </summary>
        <div className={styles.timetable}>
          <p className={styles.note}>Matching flights · all times local to each airport</p>
          <ul className={styles.flights}>
            {group.flights.map((f) => (
              <li className={styles.flight} key={f.id}>
                <div className={styles.ident}><strong>{f.flightNumber}</strong><span>{f.airline.name}</span></div>
                <div className={styles.times}><span><small>Dep</small> {f.depLocal}</span><span><small>Arr</small> {f.arrLocal}</span></div>
                <div className={styles.aircraft}>{f.aircraft.join(" / ")}</div>
                <div className={styles.duration}>{formatDuration(f.durationMin)}</div>
                <div className={styles.action}><PlanButton flight={f} /></div>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </li>
  );
}
