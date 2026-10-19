import { describe, it, expect } from "vitest";
import { buildContactEmail, contactSubject } from "@/lib/contact-message";

describe("contactSubject", () => {
  it("uses the first line so the inbox list says what it's about", () => {
    expect(contactSubject("Can I sell audio files?\n\nI make sample packs.")).toBe(
      "Halvo contact: Can I sell audio files?",
    );
  });

  it("truncates a long first line rather than filling the subject bar", () => {
    const subject = contactSubject("x".repeat(200));
    expect(subject.length).toBeLessThanOrEqual(90);
    expect(subject.endsWith("…")).toBe(true);
  });

  it("falls back when there is nothing to summarise", () => {
    expect(contactSubject("   ")).toBe("Halvo contact form");
  });
});

describe("buildContactEmail", () => {
  it("escapes the message and the sender — anyone can type into this form", () => {
    const { html } = buildContactEmail({
      fromEmail: '"><script>alert(1)</script>@x.com',
      message: "<script>alert('hi')</script> & co",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; co");
  });

  it("keeps the line breaks the person typed", () => {
    const { html, text } = buildContactEmail({ fromEmail: "a@b.co", message: "line one\nline two\n\npara two" });
    expect(html).toContain("line one<br>line two");
    expect(html).toContain("<p style=\"margin:0 0 12px\">para two</p>");
    expect(text).toContain("line one\nline two");
  });

  it("names the sender in both parts, so a reply reaches them", () => {
    const { html, text } = buildContactEmail({ fromEmail: "ask@me.com", message: "hello" });
    expect(html).toContain("mailto:ask@me.com");
    expect(text).toContain("From ask@me.com");
  });
});
