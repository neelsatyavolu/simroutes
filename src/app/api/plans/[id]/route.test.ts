import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";
import { requireUser } from "@/lib/api";
import { addToLogbook, deletePlanLogbookFlight } from "@/lib/logbook/repo";
import { getPlan, updatePlan } from "@/lib/planner/repo";
import type { Plan } from "@/lib/planner/repo";

vi.mock("@/lib/api", () => ({
  requireUser: vi.fn(),
  jsonError: (error: string, status: number) => Response.json({ error }, { status }),
  serverError: () => Response.json({ error: "Internal error" }, { status: 500 }),
}));
vi.mock("@/lib/logbook/repo", () => ({ addToLogbook: vi.fn(), deletePlanLogbookFlight: vi.fn() }));
vi.mock("@/lib/planner/repo", () => ({ getPlan: vi.fn(), updatePlan: vi.fn(), deletePlan: vi.fn() }));

const id = "00000000-0000-0000-0000-000000000001";
const plan: Plan = {
  id, plannedDate: "2026-09-01", flightNumber: "BA1", airlineName: "British Airways", airlineIcao: "BAW", airlineIata: "BA",
  depIcao: "EGLL", arrIcao: "KJFK", aircraft: "A359", depLocal: "10:00", blockMinutes: 480, status: "flown", ofp: null,
};
const patch = (status: string) => PATCH(new Request(`http://localhost/api/plans/${id}`, {
  method: "PATCH", body: JSON.stringify({ status }),
}), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireUser).mockResolvedValue({ userId: "user-1" });
  vi.mocked(getPlan).mockResolvedValue(plan);
  vi.mocked(updatePlan).mockResolvedValue({ ...plan, status: "planned" });
});

describe("PATCH plan status", () => {
  it("restores an older flight and removes only its linked logbook entry", async () => {
    const response = await patch("planned");
    expect(response.status).toBe(200);
    expect(deletePlanLogbookFlight).toHaveBeenCalledWith("user-1", id);
    expect(addToLogbook).not.toHaveBeenCalled();
    expect(updatePlan).toHaveBeenCalledWith("user-1", id, { status: "planned" });
    expect((await response.json()).plan.plannedDate).toBe(plan.plannedDate);
  });

  it("does not add a logbook entry when repeating mark unflown", async () => {
    vi.mocked(getPlan).mockResolvedValue({ ...plan, status: "planned" });
    expect((await patch("planned")).status).toBe(200);
    expect(addToLogbook).not.toHaveBeenCalled();
  });

  it("can mark a restored plan flown again", async () => {
    vi.mocked(getPlan).mockResolvedValue({ ...plan, status: "planned" });
    expect((await patch("flown")).status).toBe(200);
    expect(addToLogbook).toHaveBeenCalledWith("user-1", "plan", [expect.objectContaining({ externalId: id })]);
    expect(deletePlanLogbookFlight).not.toHaveBeenCalled();
  });

  it("does not update the plan if logbook removal fails", async () => {
    vi.mocked(deletePlanLogbookFlight).mockRejectedValue(new Error("Database unavailable"));
    expect((await patch("planned")).status).toBe(500);
    expect(updatePlan).not.toHaveBeenCalled();
  });

  it("does not change a missing plan", async () => {
    vi.mocked(getPlan).mockResolvedValue(null);
    expect((await patch("planned")).status).toBe(404);
    expect(deletePlanLogbookFlight).not.toHaveBeenCalled();
    expect(updatePlan).not.toHaveBeenCalled();
  });
});
