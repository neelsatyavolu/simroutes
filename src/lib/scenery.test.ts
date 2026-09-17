import { describe, expect, it } from "vitest";
import { matchScenery, parseSceneryCatalog } from "@/lib/scenery";

const row = (title: string, status: string, slug: string, important = false) =>
  `<div class="scad-comp24-yes">${status}</div> <a class="scad-ml-post" href="https://sceneryaddons.org/${slug}/">${title}</a> ${important ? '<div class="scad-ml-important">Important</div>' : ''}<br>`;

describe("MSFS 2024 scenery", () => {
  it("matches whole airport codes and ranks native, compatible, then tested", () => {
    const catalog = parseSceneryCatalog([
      row("A &#8211; KJFK Airport", "Yes &#8211; Tested", "tested"),
      row("B &#8211; KJFK Airport", "Yes &#8211; Compatible", "compatible"),
      row("C &#8211; KJFK Airport", "Yes &#8211; Native", "native"),
      row("D &#8211; KJFKX Airport", "Yes &#8211; Native", "other"),
      row("E &#8211; KJFK Airport", "No &#8211; Broken terrain", "broken"),
      row("F &#8211; KJFK Airport", "Unknown", "unknown"),
      row("Asobo Studio &#8211; KJFK Airport", "Yes &#8211; Native", "default"),
    ].join("\n"));
    const result = matchScenery(catalog, "KJFK");
    expect(result.results.map((r) => r.compatibility)).toEqual(["native", "compatible", "tested"]);
    expect(result.recommendedUrl).toBe("https://sceneryaddons.org/native/");
  });

  it("preserves important notices, matches bundles, and does not invent a winner for ties", () => {
    const catalog = parseSceneryCatalog([
      row("A &#8211; KJFK &amp; KLGA Airports", "Yes &#8211; Native", "bundle", true),
      row("B &#8211; KLGA Airport", "Yes &#8211; Native", "b"),
      row("C &#8211; KLGA Airport", "Yes &#8211; Native", "c"),
    ].join("\n"));
    expect(matchScenery(catalog, "KJFK").results[0]).toMatchObject({ developer: "A", important: true, title: "A – KJFK & KLGA Airports" });
    const result = matchScenery(catalog, "KLGA");
    expect(result.results[2].important).toBe(true);
    expect(result.recommendedUrl).toBeNull();
    expect(matchScenery(catalog, "EGLL").results).toEqual([]);
  });

  it("rejects unexpected pages and excludes unsafe source links", () => {
    expect(() => parseSceneryCatalog("<html>Access denied</html>")).toThrow();
    const html = row("A &#8211; KJFK Airport", "Yes &#8211; Native", "a");
    expect(() => parseSceneryCatalog(html.replace("https://sceneryaddons.org/a/", "javascript:alert(1)"))).toThrow();
  });
});
