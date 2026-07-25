// Minimal, correct CSV builder. Pure and tested, because the failure mode —
// an unescaped comma or quote silently shifting every column — is the kind of
// bug that only shows up in the one export that matters.
export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const escape = (value: string | number): string => {
    const s = String(value);
    // Quote if the value contains a comma, quote, or newline; double up quotes.
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
  return lines.join("\r\n");
}
