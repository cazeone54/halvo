import { Toaster } from "sonner";
import { useTheme } from "@/components/theme-provider";

// sonner's theme prop accepts exactly "light" | "dark" | "system", the same
// three values our own ThemeProvider tracks — reusing it directly keeps
// toasts in sync with a manual light/dark override, not just OS preference.
export function AppToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} richColors position="top-right" closeButton />;
}
