import { db } from "../db";
import type { OfpSummary } from "./simbrief";

export interface NewPlan {
  plannedDate: string;
  flightNumber: string;
  airlineName: string;
  airlineIcao: string;
  airlineIata: string;
  depIcao: string;
  arrIcao: string;
  aircraft: string;
  depLocal: string;
  blockMinutes: number;
}

export interface Plan extends NewPlan {
  id: string;
  status: "planned" | "flown";
  ofp: OfpSummary | null;
}

export const MAX_PLANS = 500;

type Row = {
  id: string; planned_date: string | Date; flight_number: string; airline_name: string; airline_icao: string; airline_iata: string;
  dep_icao: string; arr_icao: string; aircraft: string; dep_local: string; block_minutes: number; status: Plan["status"]; ofp: OfpSummary | null;
};

const dateOnly = (d: string | Date) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

const toPlan = (r: Row): Plan => ({
  id: r.id,
  plannedDate: dateOnly(r.planned_date),
  flightNumber: r.flight_number,
  airlineName: r.airline_name,
  airlineIcao: r.airline_icao,
  airlineIata: r.airline_iata,
  depIcao: r.dep_icao,
  arrIcao: r.arr_icao,
  aircraft: r.aircraft,
  depLocal: r.dep_local,
  blockMinutes: r.block_minutes,
  status: r.status,
  ofp: r.ofp,
});

// planned_date is returned as text to avoid timezone shifts on a date-only column.
const COLUMNS = "id, planned_date::text AS planned_date, flight_number, airline_name, airline_icao, airline_iata, dep_icao, arr_icao, aircraft, dep_local, block_minutes, status, ofp";

export async function listPlans(userId: string): Promise<Plan[]> {
  const rows = (await db().query(
    `SELECT ${COLUMNS} FROM planned_flights WHERE user_id = $1 ORDER BY planned_date, dep_local, created_at LIMIT ${MAX_PLANS}`,
    [userId],
  )) as Row[];
  return rows.map(toPlan);
}

export async function getPlan(userId: string, id: string): Promise<Plan | null> {
  const rows = (await db().query(`SELECT ${COLUMNS} FROM planned_flights WHERE user_id = $1 AND id = $2`, [userId, id])) as Row[];
  return rows[0] ? toPlan(rows[0]) : null;
}

export async function countPlans(userId: string): Promise<number> {
  const [row] = (await db()`SELECT count(*)::int AS n FROM planned_flights WHERE user_id = ${userId}`) as { n: number }[];
  return row.n;
}

export async function createPlan(userId: string, p: NewPlan): Promise<Plan> {
  const rows = (await db().query(
    `INSERT INTO planned_flights (user_id, planned_date, flight_number, airline_name, airline_icao, airline_iata, dep_icao, arr_icao, aircraft, dep_local, block_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING ${COLUMNS}`,
    [userId, p.plannedDate, p.flightNumber, p.airlineName, p.airlineIcao, p.airlineIata, p.depIcao, p.arrIcao, p.aircraft, p.depLocal, p.blockMinutes],
  )) as Row[];
  return toPlan(rows[0]);
}

export async function updatePlan(
  userId: string,
  id: string,
  changes: { plannedDate?: string; status?: Plan["status"]; ofp?: OfpSummary | null },
): Promise<Plan | null> {
  const rows = (await db().query(
    `UPDATE planned_flights SET
       planned_date = COALESCE($3::date, planned_date),
       status = COALESCE($4, status),
       ofp = CASE WHEN $5::boolean THEN $6::jsonb ELSE ofp END
     WHERE user_id = $1 AND id = $2 RETURNING ${COLUMNS}`,
    [userId, id, changes.plannedDate ?? null, changes.status ?? null, "ofp" in changes, changes.ofp ? JSON.stringify(changes.ofp) : null],
  )) as Row[];
  return rows[0] ? toPlan(rows[0]) : null;
}

export async function deletePlan(userId: string, id: string): Promise<boolean> {
  const rows = (await db()`DELETE FROM planned_flights WHERE user_id = ${userId} AND id = ${id} RETURNING id`) as unknown[];
  return rows.length > 0;
}
