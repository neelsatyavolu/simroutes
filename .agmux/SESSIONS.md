# agmux Session Handoffs

> Optional prior-session context for agents. Use only when you need history — not every turn.
> Prefer MCP tools `session_list` / `session_get` on server `agmux-memory`. This file is the projection.
> Each entry has a short summary and a transcript path you can Read for detail.

- **Project**: `930dba21-0349-4fa5-9776-07b31e7d4d7f`
- **Revision**: 6
- **Updated**: 2026-09-17T22:08:32.333Z
- **Sessions**: 5

## Airport scenery tab and production fetch fallback

- **id**: `01a0b15c-da6c-78a3-af5a-bc652f2a0289`
- **provider**: unknown
- **status**: idle
- **updated**: 2026-09-17T22:08:32.333Z
- **transcript**: _(none resolved)_

Implemented MSFS 2024 Airports tab in earlier turn. Follow-up screenshot: inspected Vercel logs for project simroutes; production KORD requests returned 502, proving upstream non-OK source response rather than missing airport data. Added scenery-store loader with live-first fetch and bundled dated data/scenery.json fallback (2007 source listings captured 2026-09-17), refresh script/npm data:scenery, UI saved-date notice replacing misleading hourly claim, README. Regression tests cover source 403, timeout, invalid HTML and live success. KORD snapshot includes FSDreamTeam compatible and iniBuilds native (recommended). 135 tests, lint, build, diff checks passed; verified production function NFT includes snapshot. Changes local, not deployed. Browser still unavailable.

## Five airport-size tiers

- **id**: `01a0b0b2-cfba-75b1-8f46-e064463f4a32`
- **provider**: unknown
- **status**: idle
- **updated**: 2026-09-17T18:55:53.512Z
- **transcript**: _(none resolved)_

Implemented Super Large/Large/Medium/Small/Mini using OurAirports airport role, scheduled service, and open runway infrastructure. New pure classifier and six tests cover boundaries, missing data, closed/unpaved/water/helipad exclusion, new-tier API round trips and exact multi-select filtering. Builder now downloads runway CSV as well as airport CSV; regenerated data/airports.json (32,487 records). Updated filter UI with descriptive two-column multi-select buttons, Any size per endpoint, explanation disclosure, accessible pressed states/focus styles; flight badges use shared labels. README documents heuristics. Added vitest.config.mts alias support. All 125 tests, lint, tsc, production build, git diff --check passed. Browser unavailable (CUA says no browser available), so no visual/interaction QA; local server HTTP 200 but page behind client auth so not proof of filter render. Dev server stopped. Preserved concurrent flight-number/ForYou/SearchView and AGENTS.md edits. No paid schedules fetched, no auth or SQL changes, no commit.

## Flight-number search

- **id**: `01a0b0b2-8d70-76d3-a61f-2a2f953133f9`
- **provider**: unknown
- **status**: idle
- **updated**: 2026-09-17T18:49:59.882Z
- **transcript**: _(none resolved)_

Added Flight number input to Search tab FilterPanel, integrated Filters/URL params/SearchQuery/parser, and normalized substring matching ignoring case and whitespace. Combines with existing filters and Clear all; updated no-results hint. Added matching/parser/serialization regression tests (observed failures before implementation). Verified all 119 tests, lint, TypeScript --noEmit, and diff whitespace checks pass. Existing AGENTS.md/.agmux changes and concurrent ForYou/SearchView changes left intact; our SearchView change is only no-results hint.

## Default Search to For you

- **id**: `01a0b0b2-5f7f-7b91-9fe3-d1ade1ab4794`
- **provider**: unknown
- **status**: idle
- **updated**: 2026-09-17T18:49:31.661Z
- **transcript**: _(none resolved)_

SearchView now opens with existing ForYou suggestions embedded beside filters; changing filters or sort switches to regular search, and a For you button resets filters and returns to suggestions. ForYou supports embedded layout without logbook sidebar and directs users without a profile to the For you tab for import. npm run lint, npx tsc --noEmit, npm test (116 tests) and git diff --check passed. No browser verification. Left unrelated AGENTS.md, .agmux and concurrent filters/search test edits untouched.

## AGENTS.md project guide

- **id**: `ef110cad-751f-4eb5-b5a1-44fcf657a597`
- **provider**: unknown
- **status**: idle
- **updated**: 2026-09-17T18:42:23.454Z
- **transcript**: _(none resolved)_

Wrote the SimRoutes project guide into AGENTS.md (CLAUDE.md is just `@AGENTS.md`, left untouched), keeping the auto-generated nextjs-agent-rules block at the top. Content derived from reading package.json, README, configs, src/lib and route handlers: stack (Next 16 App Router, React 19, CSS Modules, Clerk, Neon, Vercel Blob, zod, Vitest), commands table incl. single-test invocation, directory layout, conventions (src/lib/api.ts helpers requireUser/jsonError/serverError, ok-discriminated validation parsers, bare Response.json + satisfies, http.ts fetch helpers, SQL only in repo.ts scoped by user_id, colocated *.test.ts), domain glossary, env vars, and hard stops (AeroDataBox quota, 7-day MAX_RETENTION_MS cap, destructive migrations, auth scoping). ~85 lines, no rules files created. Nothing committed.
