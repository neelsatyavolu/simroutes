/**
 * Normalises aircraft names from schedules ("Boeing 737-800 (winglets)"), logbooks ("B738")
 * and sim titles ("PMDG 737-800") to ICAO type designators and broader families.
 */

export interface AircraftType {
  /** ICAO type designator, or null when only the family is known ("Boeing 737"). */
  code: string | null;
  family: string;
}

// [ICAO code, family, pattern on the compacted lowercase name]. Order matters: specific before generic.
const TYPES: [string, string, RegExp][] = [
  ["A20N", "A320", /a320neo|a32nx|a32n|a20n/],
  ["A21N", "A320", /a321neo|a21n/],
  ["A19N", "A320", /a319neo|a19n/],
  ["A318", "A320", /a318/],
  ["A319", "A320", /a319/],
  ["A320", "A320", /a320/],
  ["A321", "A320", /a321/],
  ["BCS1", "A220", /a220100|bcs1|cs100/],
  ["BCS3", "A220", /a220300|bcs3|cs300/],
  ["A332", "A330", /a330200|a332/],
  ["A333", "A330", /a330300|a333/],
  ["A338", "A330", /a330800|a338/],
  ["A339", "A330", /a330900|a339/],
  ["A343", "A340", /a340300|a343/],
  ["A346", "A340", /a340600|a346/],
  ["A35K", "A350", /a3501000|a35k/],
  ["A359", "A350", /a350900|a359/],
  ["A388", "A380", /a380/],
  ["A310", "A310", /a310/],
  ["B38M", "B737", /737max8|b38m/],
  ["B39M", "B737", /737max9|b39m/],
  ["B732", "B737", /737200/],
  ["B733", "B737", /737300/],
  ["B734", "B737", /737400/],
  ["B735", "B737", /737500/],
  ["B736", "B737", /737600/],
  ["B737", "B737", /737700/],
  ["B738", "B737", /737800|b738/],
  ["B739", "B737", /737900|b739/],
  ["B741", "B747", /747100/],
  ["B742", "B747", /747200/],
  ["B744", "B747", /747400|b744/],
  ["B748", "B747", /7478|b748/],
  ["B752", "B757", /757200|b752/],
  ["B753", "B757", /757300|b753/],
  ["B763", "B767", /767300|b763/],
  ["B764", "B767", /767400|b764/],
  ["B77W", "B777", /777300er|b77w/],
  ["B77L", "B777", /777200lr|b77l/],
  ["B773", "B777", /777300|b773/],
  ["B772", "B777", /777200|b772/],
  ["B78X", "B787", /78710|b78x/],
  ["B788", "B787", /7878|b788/],
  ["B789", "B787", /7879|b789/],
  ["B712", "B717", /717/],
  ["E295", "EJET", /195e2|e295/],
  ["E290", "EJET", /190e2|e290/],
  ["E170", "EJET", /embraer170|e170/],
  ["E175", "EJET", /embraer175|erj175|e175/],
  ["E190", "EJET", /embraer190|e190/],
  ["E195", "EJET", /embraer195|e195/],
  ["E145", "ERJ", /rj145|e145/],
  ["E140", "ERJ", /rj140|embraer140|e140/],
  ["E135", "ERJ", /rj135|embraer135|e135/],
  ["CRJX", "CRJ", /crj1000|crjx/],
  ["CRJ9", "CRJ", /crj900|crj9/],
  ["CRJ7", "CRJ", /crj70|regjet700|crj7/],
  ["CRJ2", "CRJ", /crj200|crj100|crj2/],
  ["DH8D", "DASH8", /q400|dhc8400|dh8d/],
  ["DH8C", "DASH8", /q300|dhc8300|dh8c/],
  ["DH8B", "DASH8", /q200|dhc8200|dh8b/],
  ["AT76", "ATR", /atr72600|at76/],
  ["AT75", "ATR", /atr72500|at75/],
  ["AT72", "ATR", /atr72|at72/],
  ["AT45", "ATR", /atr42500|at45/],
  ["AT43", "ATR", /atr42|at43/],
  ["SF34", "SAAB340", /saab340|sf34/],
  ["C208", "C208", /caravan|c208/],
  ["MD88", "MD80", /md88/],
  ["MD83", "MD80", /md83/],
  ["MD82", "MD80", /md82/],
  ["SU95", "SSJ", /superjet|su95/],
  ["C919", "C919", /c919/],
];

// Series names without a variant ("Boeing 737") only tell us the family.
const FAMILIES: [string, RegExp][] = [
  ["B737", /boeing737/],
  ["B747", /boeing747/],
  ["B757", /boeing757/],
  ["B767", /boeing767/],
  ["B777", /boeing777/],
  ["B787", /boeing787/],
  ["A330", /a330/],
  ["A340", /a340/],
  ["A350", /a350/],
  ["CRJ", /crj|regionaljet|canadairrj/],
];

const FAMILY_BY_CODE = new Map(TYPES.map(([code, family]) => [code, family]));

const compact = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

export function resolveType(name: string): AircraftType | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  const family = FAMILY_BY_CODE.get(upper);
  if (family) return { code: upper, family };

  const c = compact(trimmed);
  for (const [code, fam, pattern] of TYPES) if (pattern.test(c)) return { code, family: fam };
  for (const [fam, pattern] of FAMILIES) if (pattern.test(c)) return { code: null, family: fam };
  return null;
}

export const familyOf = (code: string): string | null => FAMILY_BY_CODE.get(code) ?? null;
