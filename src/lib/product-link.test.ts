import { describe, expect, it } from "vitest";
import { linkButtonLabel, normalizeDeliveryUrl } from "./product-link";

describe("normalizeDeliveryUrl", () => {
  it("accepts the links sellers actually paste, adding https:// when it's missing", () => {
    expect(normalizeDeliveryUrl("https://www.notion.so/My-Tracker-1a2b3c?pvs=4")).toEqual({
      url: "https://www.notion.so/My-Tracker-1a2b3c?pvs=4",
    });
    expect(normalizeDeliveryUrl("  canva.com/design/DAF123/view?utm_content=x  ")).toEqual({
      url: "https://canva.com/design/DAF123/view?utm_content=x",
    });
    expect(normalizeDeliveryUrl("http://example.com/file")).toEqual({ url: "http://example.com/file" });
  });

  it("refuses anything a buyer shouldn't be sent to", () => {
    for (const bad of ["", "   ", "javascript:alert(1)", "data:text/html,hi", "ftp://x.com/a", "notalink", "https://user:pw@evil.com/"]) {
      expect(normalizeDeliveryUrl(bad)).toHaveProperty("error");
    }
    expect(normalizeDeliveryUrl(`https://x.com/${"a".repeat(2100)}`)).toHaveProperty("error");
  });
});

describe("linkButtonLabel", () => {
  it("uses the seller's own words when given", () => {
    expect(linkButtonLabel("  Duplicate the template  ", "https://notion.so/x")).toBe("Duplicate the template");
  });
  it("otherwise says where the link goes", () => {
    expect(linkButtonLabel(null, "https://www.notion.so/x")).toBe("Open in Notion");
    expect(linkButtonLabel("", "https://acme.notion.site/x")).toBe("Open in Notion");
    expect(linkButtonLabel(null, "https://www.canva.com/design/x")).toBe("Open in Canva");
    expect(linkButtonLabel(null, "https://drive.google.com/drive/folders/x")).toBe("Open in Google Drive");
    expect(linkButtonLabel(null, "https://www.example.com/course")).toBe("Open example.com");
  });
});
