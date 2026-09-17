import { loadDataset } from "@/lib/data";
import { buildOptions } from "@/lib/options";

export async function GET() {
  try {
    return Response.json(buildOptions(await loadDataset()));
  } catch (error) {
    console.error("GET /api/options failed", error);
    return Response.json({ error: "Could not load flight data" }, { status: 500 });
  }
}
