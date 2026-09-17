import { describe, expect, it } from "vitest";
import { groupPlans } from "./group";
import type { Plan } from "./repo";

const plan = (id: string, plannedDate: string, over: Partial<Plan> = {}): Plan => ({
  id, plannedDate, flightNumber: id, airlineName: "", airlineIcao: "", airlineIata: "", depIcao: "EGLL", arrIcao: "KJFK",
  aircraft: "A359", depLocal: "10:00", blockMinutes: 480, status: "planned", ofp: null, ...over,
});

describe("groupPlans", () => {
  it("splits upcoming by day, overdue and flown", () => {
    const groups = groupPlans(
      [
        plan("tomorrow-late", "2026-09-18", { depLocal: "22:00" }),
        plan("today", "2026-09-17"),
        plan("tomorrow-early", "2026-09-18", { depLocal: "06:00" }),
        plan("late", "2026-09-15"),
        plan("done", "2026-09-14", { status: "flown" }),
        plan("done-future", "2026-09-19", { status: "flown" }),
      ],
      "2026-09-17",
    );
    expect(groups.upcoming.map((g) => [g.date, g.plans.map((p) => p.id)])).toEqual([
      ["2026-09-17", ["today"]],
      ["2026-09-18", ["tomorrow-early", "tomorrow-late"]],
    ]);
    expect(groups.overdue.map((p) => p.id)).toEqual(["late"]);
    expect(groups.flown.map((p) => p.id)).toEqual(["done-future", "done"]);
  });
});
