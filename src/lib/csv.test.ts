import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("writes a header row and data rows", () => {
    expect(toCsv(["email", "orders"], [["a@b.com", 2]])).toBe("email,orders\r\na@b.com,2");
  });

  it("quotes and escapes values that would otherwise break columns", () => {
    // A product name with a comma must not shift the columns; a quote is doubled.
    const csv = toCsv(["email", "product"], [["a@b.com", 'Kit, deluxe "v2"']]);
    expect(csv).toBe('email,product\r\na@b.com,"Kit, deluxe ""v2"""');
  });

  it("quotes values containing newlines", () => {
    expect(toCsv(["note"], [["line1\nline2"]])).toBe('note\r\n"line1\nline2"');
  });

  it("handles an empty row set", () => {
    expect(toCsv(["email"], [])).toBe("email");
  });
});
