import { createContext, useContext, useEffect } from "react";

// Settings is several forms, each with its own Save button. Each form says
// whether it has edits that aren't saved yet; the page uses that to mark its
// tab and to ask before the seller leaves and loses them.

type Report = (key: string, dirty: boolean) => void;

export const UnsavedChangesContext = createContext<Report | null>(null);

// Outside a page that listens (the context is unset), this does nothing.
export function useReportUnsaved(key: string, dirty: boolean) {
  const report = useContext(UnsavedChangesContext);
  useEffect(() => {
    report?.(key, dirty);
  }, [report, key, dirty]);
  // A form that goes away takes its unsaved state with it.
  useEffect(() => () => report?.(key, false), [report, key]);
}

// The form's values as one comparable string — what was last saved against
// what's on screen now.
export function snapshot(values: unknown): string {
  return JSON.stringify(values);
}
