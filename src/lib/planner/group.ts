import type { Plan } from "./repo";

export interface PlanGroups {
  upcoming: { date: string; plans: Plan[] }[];
  overdue: Plan[];
  /** Most recent first. */
  flown: Plan[];
}

const byDateTime = (a: Plan, b: Plan) => a.plannedDate.localeCompare(b.plannedDate) || a.depLocal.localeCompare(b.depLocal);

/** `today` is the viewer's local date (YYYY-MM-DD). */
export function groupPlans(plans: readonly Plan[], today: string): PlanGroups {
  const sorted = [...plans].sort(byDateTime);
  const upcoming = new Map<string, Plan[]>();
  for (const p of sorted) {
    if (p.status === "planned" && p.plannedDate >= today) upcoming.set(p.plannedDate, [...(upcoming.get(p.plannedDate) ?? []), p]);
  }
  return {
    upcoming: [...upcoming].map(([date, list]) => ({ date, plans: list })),
    overdue: sorted.filter((p) => p.status === "planned" && p.plannedDate < today),
    flown: sorted.filter((p) => p.status === "flown").reverse(),
  };
}
