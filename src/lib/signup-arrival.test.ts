import { describe, it, expect } from "vitest";
import { arrivalFromVisit, readArrival, rememberArrival } from "./signup-arrival";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

const DAY = 24 * 60 * 60 * 1000;

describe("arrivalFromVisit", () => {
  it("reads the ad's UTM tags and the landing page", () => {
    const a = arrivalFromVisit("https://halvo.io/for/coaches?utm_source=meta&utm_campaign=test1&utm_content=b", "");
    expect(a).toMatchObject({ utmSource: "meta", utmCampaign: "test1", utmContent: "b", landingPath: "/for/coaches", tagged: true });
  });

  it("keeps only the origin of another site, and ignores our own pages", () => {
    expect(arrivalFromVisit("https://halvo.io/", "https://l.instagram.com/?u=secret").referrer).toBe("https://l.instagram.com");
    const internal = arrivalFromVisit("https://halvo.io/pricing", "https://www.halvo.io/");
    expect(internal.referrer).toBeUndefined();
    expect(internal.tagged).toBe(false);
  });
});

describe("rememberArrival", () => {
  it("keeps the ad visit when the visitor later browses around", () => {
    const s = memoryStorage();
    rememberArrival("https://halvo.io/?utm_source=meta&utm_content=a", "", s, 0);
    rememberArrival("https://halvo.io/pricing", "https://halvo.io/", s, 1000);
    expect(readArrival(s, 2000)).toMatchObject({ utmSource: "meta", utmContent: "a", landingPath: "/" });
  });

  it("lets a later tagged visit replace an earlier one", () => {
    const s = memoryStorage();
    rememberArrival("https://halvo.io/?utm_source=instagram", "", s, 0);
    rememberArrival("https://halvo.io/?utm_source=meta&utm_content=c", "", s, DAY);
    expect(readArrival(s, DAY)).toMatchObject({ utmSource: "meta", utmContent: "c" });
  });

  it("records the landing page for someone who typed the address", () => {
    const s = memoryStorage();
    rememberArrival("https://halvo.io/features", "", s, 0);
    expect(readArrival(s, 0)).toEqual({ landingPath: "/features" });
  });

  it("forgets after 30 days and survives broken storage", () => {
    const s = memoryStorage();
    rememberArrival("https://halvo.io/?utm_source=meta", "", s, 0);
    expect(readArrival(s, 31 * DAY)).toBeNull();
    s.setItem("halvo:signup-arrival", "{nope");
    expect(readArrival(s, 0)).toBeNull();
    expect(() => rememberArrival("https://halvo.io/", "", null, 0)).not.toThrow();
  });
});
