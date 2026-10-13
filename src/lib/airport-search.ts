export interface AirportOption {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  /** Number of flights touching this airport, used to rank busier airports first. */
  count: number;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** 0 = exact code, 1 = code prefix, 2 = city/name word prefix, 3 = substring, null = no match. */
function score(a: AirportOption, q: string): number | null {
  const icao = a.icao.toLowerCase();
  const iata = a.iata.toLowerCase();
  if (q === icao || q === iata) return 0;
  if (icao.startsWith(q) || (iata && iata.startsWith(q))) return 1;
  const text = fold(`${a.city} ${a.name}`);
  if (text.split(/[\s\-/–(]+/).some((word) => word.startsWith(q))) return 2;
  if (text.includes(q)) return 3;
  return null;
}

const CODE = /^[A-Z0-9]{3,4}$/;

/** ICAO for an exact code in the field, or null when the text is not one. */
export function matchAirportCode(airports: readonly AirportOption[], text: string): string | null {
  const code = text.trim().toUpperCase();
  if (!CODE.test(code)) return null;
  return airports.find((a) => a.icao === code || (code.length === 3 && a.iata === code))?.icao ?? null;
}

/**
 * Code to apply while typing. Exact codes commit immediately, except when the
 * text is also the start of a city or name ("DAL" → Dallas, "DUB" → Dubai).
 * Anything else clears the filter so a short code cannot stick.
 */
export function airportCodeWhileTyping(airports: readonly AirportOption[], text: string): string {
  const exact = matchAirportCode(airports, text);
  if (!exact) return "";
  const typed = fold(text.trim());
  const prefixOfPlace = airports.some((a) =>
    [a.city, a.name].some((field) => {
      const value = fold(field);
      return value.startsWith(typed) && value.length > typed.length;
    }),
  );
  return prefixOfPlace ? "" : exact;
}

export function rankAirports(airports: readonly AirportOption[], query: string, limit: number): AirportOption[] {
  const q = fold(query.trim());
  if (!q) return [];
  return airports
    .flatMap((a) => {
      const s = score(a, q);
      return s === null ? [] : [{ a, s }];
    })
    .sort((x, y) => x.s - y.s || y.a.count - x.a.count)
    .slice(0, limit)
    .map((x) => x.a);
}
