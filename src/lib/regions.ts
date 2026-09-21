/** Country-code groupings for route search; transcontinental countries are grouped whole. */
export const REGIONS = [
  { value: "us", label: "US", countries: "US" },
  { value: "canada", label: "Canada", countries: "CA" },
  { value: "mexico-central-america", label: "Mexico & Central America", countries: "MX BZ CR SV GT HN NI PA" },
  { value: "caribbean", label: "Caribbean", countries: "AI AG AW BS BB BQ VG KY CU CW DM DO GD GP HT JM MQ MS PR BL KN LC MF VC SX TT TC VI" },
  { value: "south-america", label: "South America", countries: "AR BO BR CL CO EC FK GF GY PY PE SR UY VE" },
  { value: "europe", label: "Europe", countries: "AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG VA HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB AX" },
  { value: "middle-east", label: "Middle East", countries: "BH CY IR IQ IL JO KW LB OM PS QA SA SY TR AE YE" },
  { value: "central-asia", label: "Central Asia", countries: "AM AZ GE KZ KG TJ TM UZ" },
  { value: "south-asia", label: "South Asia", countries: "AF BD BT IN MV NP PK LK" },
  { value: "east-asia", label: "East Asia", countries: "CN HK JP MO MN KP KR TW" },
  { value: "southeast-asia", label: "Southeast Asia", countries: "BN KH ID LA MY MM PH SG TH TL VN" },
  { value: "africa", label: "Africa", countries: "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW" },
  { value: "oceania", label: "Oceania", countries: "AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV UM VU WF" },
  { value: "greenland", label: "Greenland", countries: "GL" },
] as const;

export type Region = (typeof REGIONS)[number]["value"];
