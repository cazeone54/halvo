import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEXT_PREVIEW_CHARS, type Preview } from "@/lib/file-preview";

type Loaded =
  | { status: "loading" }
  | { status: "ready"; src: string; text?: string }
  | { status: "error"; message: string };

// Shows a seller the file a buyer would receive, without making them download
// it. The file is fetched and rebuilt as a Blob with its real type, because
// storage serves everything as application/octet-stream — see lib/file-preview.
export function FilePreviewOverlay({
  fileName,
  signedUrl,
  preview,
  onClose,
}: {
  fileName: string;
  signedUrl: string;
  preview: Preview;
  onClose: () => void;
}) {
  const [state, setState] = useState<Loaded>({ status: "loading" });
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    (async () => {
      try {
        const res = await fetch(signedUrl);
        if (!res.ok) throw new Error("This file couldn't be loaded.");
        const raw = await res.blob();
        const typed = new Blob([raw], { type: preview.mime });
        objectUrl = URL.createObjectURL(typed);
        const text = preview.kind === "text" ? (await typed.text()).slice(0, TEXT_PREVIEW_CHARS) : undefined;
        if (!cancelled) setState({ status: "ready", src: objectUrl, text });
      } catch (e) {
        if (!cancelled) {
          setState({
            status: "error",
            message: e instanceof Error ? e.message : "This file couldn't be loaded.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [signedUrl, preview.mime, preview.kind]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Rendered into <body>: the product card it is opened from animates on
  // hover, and a transformed ancestor makes `position: fixed` resolve against
  // that card instead of the window — which trapped this panel inside it.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${fileName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-card shadow-lg">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <p className="truncate text-sm font-medium" title={fileName}>
            {fileName}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild variant="outline" size="sm">
              {/* The signed link, so the seller can keep a copy if they want one. */}
              <a href={signedUrl} download={fileName} rel="noreferrer noopener">
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </Button>
            <Button ref={closeRef} variant="ghost" size="sm" onClick={onClose} aria-label="Close preview">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
          {state.status === "loading" ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading the file…</p>
          ) : state.status === "error" ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {state.message} You can still download it with the button above.
            </p>
          ) : preview.kind === "image" ? (
            <img src={state.src} alt={fileName} className="mx-auto max-h-[65vh] w-auto rounded-md" />
          ) : preview.kind === "pdf" ? (
            <iframe src={state.src} title={fileName} className="h-[65vh] w-full rounded-md border bg-background" />
          ) : preview.kind === "video" ? (
            <video src={state.src} controls className="mx-auto max-h-[65vh] w-full rounded-md" />
          ) : preview.kind === "audio" ? (
            <audio src={state.src} controls className="w-full" />
          ) : (
            <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 text-xs">
              {state.text}
            </pre>
          )}
        </div>

        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          This is the file buyers receive. Looking at it here doesn&apos;t count as a download.
        </p>
      </div>
    </div>,
    document.body,
  );
}
