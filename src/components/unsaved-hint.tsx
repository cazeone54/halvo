// Beside a Save button: says plainly that what's on screen isn't saved yet.
export function UnsavedHint({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span>;
}
