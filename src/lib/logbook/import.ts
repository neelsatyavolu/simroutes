import { loadAirports } from "../data";
import type { ImportResponse } from "../types";
import type { ParsedLogbookRow } from "./parse-csv";
import { addToLogbook, countLogbook, MAX_LOGBOOK_FLIGHTS, type LogbookSource } from "./repo";
import { toLogbookFlights } from "./to-flights";

const MAX_REPORTED_ERRORS = 20;

/** Converts parsed rows, stores them and summarises the outcome for the UI. */
export async function importRows(
  userId: string,
  source: LogbookSource,
  rows: readonly ParsedLogbookRow[],
  parseErrors: readonly string[] = [],
): Promise<ImportResponse> {
  const { flights, errors } = toLogbookFlights(rows, await loadAirports());
  const room = Math.max(0, MAX_LOGBOOK_FLIGHTS - (await countLogbook(userId)));
  const accepted = flights.slice(0, room);
  const added = await addToLogbook(userId, source, accepted);
  const allErrors = [
    ...parseErrors,
    ...errors,
    ...(flights.length > room ? [`Logbook limit of ${MAX_LOGBOOK_FLIGHTS} flights reached; ${flights.length - room} not imported`] : []),
  ];
  return {
    added,
    duplicates: accepted.length - added,
    errors: allErrors.length > MAX_REPORTED_ERRORS
      ? [...allErrors.slice(0, MAX_REPORTED_ERRORS), `…and ${allErrors.length - MAX_REPORTED_ERRORS} more`]
      : allErrors,
  };
}
