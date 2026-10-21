import { describe, expect, it } from "vitest";
import { publicFeed } from "./feed";

describe("publicFeed (what the public home page may see)", () => {
  it("gives country totals only, biggest first, hiding countries with fewer than 3 events", () => {
    const feed = publicFeed(
      [
        { country: "NL", n: 12 },
        { country: "US", n: 40 },
        { country: "BR", n: 2 }, // too few: could point at one person
        { country: "XX", n: 50 }, // unknown code: no place on the globe
      ],
      1,
    );
    expect(feed).toEqual({
      mode: "live",
      total: 52,
      highAlerts: 1,
      countries: [
        { code: "US", lat: expect.any(Number), lon: expect.any(Number), attacks: 40 },
        { code: "NL", lat: expect.any(Number), lon: expect.any(Number), attacks: 12 },
      ],
    });
  });

  it("says 'simulated' when there's nothing real to show", () => {
    expect(publicFeed([{ country: "BR", n: 1 }], 0)).toEqual({
      mode: "simulated",
      total: 0,
      highAlerts: 0,
      countries: [],
    });
  });

  it("never carries anything but codes, coordinates and counts", () => {
    const feed = publicFeed([{ country: "DE", n: 5 }], 0);
    expect(Object.keys(feed.countries[0]!).sort()).toEqual(["attacks", "code", "lat", "lon"]);
  });
});
