import { jsonError, requireUser, serverError } from "@/lib/api";
import { importRows } from "@/lib/logbook/import";
import { parseLogbookCsv } from "@/lib/logbook/parse-csv";

const MAX_BYTES = 2 * 1024 * 1024;

/** Body: the raw CSV text. */
export async function POST(request: Request) {
  const user = await requireUser();
  if ("response" in user) return user.response;

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return jsonError("File is too large (2 MB max)", 413);
  const text = await request.text();
  if (text.length > MAX_BYTES) return jsonError("File is too large (2 MB max)", 413);
  if (!text.trim()) return jsonError("The file is empty", 400);

  const { rows, errors } = parseLogbookCsv(text);
  if (rows.length === 0) return jsonError(errors[0] ?? "No flights found in the file", 422);
  try {
    return Response.json(await importRows(user.userId, "csv", rows, errors));
  } catch (error) {
    return serverError("POST /api/logbook/import/csv failed", error);
  }
}
