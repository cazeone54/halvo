import { describe, expect, it } from "vitest";
import { categoryLabel } from "./category-label";

describe("categoryLabel", () => {
  it("spells initials as initials", () => {
    expect(categoryLabel("ai")).toBe("AI");
    expect(categoryLabel("ui kits")).toBe("UI Kits");
    expect(categoryLabel("3d")).toBe("3D");
    expect(categoryLabel("saas")).toBe("SaaS");
  });

  it("capitalises ordinary words and keeps the separators", () => {
    expect(categoryLabel("guides")).toBe("Guides");
    expect(categoryLabel("sound design")).toBe("Sound Design");
    expect(categoryLabel("e-books")).toBe("E-Books");
    expect(categoryLabel("ai/automation")).toBe("AI/Automation");
  });

  it("leaves a seller's own capitals alone", () => {
    expect(categoryLabel("iPhone wallpapers")).toBe("iPhone Wallpapers");
    expect(categoryLabel("Notion")).toBe("Notion");
  });
});
