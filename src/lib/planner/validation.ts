import { z } from "zod";
import type { NewPlan } from "./repo";

const DAY_MS = 86_400_000;
const MAX_DAYS_AHEAD = 365;

const isoDate = (today: Date) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .refine((d) => new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), "That date doesn't exist")
    .refine((d) => {
      const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
      const days = (Date.parse(`${d}T00:00:00Z`) - start) / DAY_MS;
      // One day of slack for users ahead of or behind UTC.
      return days >= -1 && days <= MAX_DAYS_AHEAD;
    }, "Pick a date between today and a year from now");

const icao = z.string().regex(/^[A-Z0-9]{4}$/, "Invalid airport code");

const newPlanSchema = (today: Date) =>
  z.object({
    plannedDate: isoDate(today),
    flightNumber: z.string().trim().min(1).max(12),
    airline: z.object({ name: z.string().max(80), icao: z.string().max(4), iata: z.string().max(3) }),
    depIcao: icao,
    arrIcao: icao,
    aircraft: z.string().trim().min(1, "Choose an aircraft").max(80),
    depLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid departure time"),
    durationMin: z.number().int().positive().max(24 * 60),
  });

const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Invalid request";

export function parseNewPlan(input: unknown, today: Date): { ok: true; plan: NewPlan } | { ok: false; error: string } {
  const parsed = newPlanSchema(today).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const p = parsed.data;
  return {
    ok: true,
    plan: {
      plannedDate: p.plannedDate,
      flightNumber: p.flightNumber,
      airlineName: p.airline.name,
      airlineIcao: p.airline.icao,
      airlineIata: p.airline.iata,
      depIcao: p.depIcao,
      arrIcao: p.arrIcao,
      aircraft: p.aircraft,
      depLocal: p.depLocal,
      blockMinutes: p.durationMin,
    },
  };
}

export type PlanUpdate = { plannedDate: string } | { status: "planned" | "flown" };

export function parsePlanUpdate(input: unknown, today: Date): { ok: true; update: PlanUpdate } | { ok: false; error: string } {
  if (input && typeof input === "object" && "plannedDate" in input) {
    const parsed = z.object({ plannedDate: isoDate(today) }).strict().safeParse(input);
    return parsed.success ? { ok: true, update: parsed.data } : { ok: false, error: firstIssue(parsed.error) };
  }
  const parsed = z.object({ status: z.enum(["planned", "flown"]) }).strict().safeParse(input);
  return parsed.success ? { ok: true, update: parsed.data } : { ok: false, error: 'Send a new plannedDate or status "planned" or "flown"' };
}
