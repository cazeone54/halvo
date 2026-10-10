import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { ArrowLeft, ArrowRight, Check, Circle, PartyPopper } from "lucide-react";
import { getReadableLesson } from "@/lib/downloads.functions";
import { parseInline, parseMarkdown, progressSummary, splitIntoLessons } from "@/lib/lesson-reader";
import { LessonContent } from "@/components/lesson-content";
import { Button } from "@/components/ui/button";
import { BRAND_KEY, BRAND_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

// The online course reader. A purchase link (?id=) plus one of its text
// lesson files (?file=). Access is the same gate as downloads; progress is
// saved on this device, since buyers don't have accounts to sync it to.
export const Route = createFileRoute("/learn")({
  validateSearch: zodValidator(
    z.object({ id: z.string().uuid().optional().catch(undefined), file: z.string().uuid().optional().catch(undefined) }),
  ),
  head: () => ({ meta: [{ title: `Course — ${BRAND_NAME}` }, { name: "robots", content: "noindex" }] }),
  component: LearnPage,
});

const storageKey = (id: string, file: string) => `${BRAND_KEY}:course:${id}:${file}`;

function readProgress(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function LearnPage() {
  const { id, file } = Route.useSearch();
  const lessonFn = useServerFn(getReadableLesson);
  const lessonQ = useQuery({
    queryKey: ["readable-lesson", id, file],
    queryFn: () => lessonFn({ data: { transactionId: id!, fileId: file! } }),
    enabled: !!id && !!file,
    staleTime: Infinity,
  });

  if (!id || !file) {
    return (
      <Notice
        title="Nothing to read here"
        body="Open your course from the download page — the link is in your purchase email."
      />
    );
  }
  if (lessonQ.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12" role="status">
        <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-4 w-full animate-pulse rounded bg-muted" />
        <div className="mt-3 h-4 w-11/12 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-muted" />
        <span className="sr-only">Opening your course…</span>
      </div>
    );
  }
  if (lessonQ.isError || !lessonQ.data) {
    return (
      <Notice
        title="We couldn't open this course"
        body={lessonQ.error instanceof Error ? lessonQ.error.message : "Please try again from your download page."}
        backId={id}
      />
    );
  }
  return <Reader transactionId={id} fileId={file} markdown={lessonQ.data.markdown} />;
}

function Reader({ transactionId, fileId, markdown }: { transactionId: string; fileId: string; markdown: string }) {
  const course = useMemo(() => splitIntoLessons(parseMarkdown(markdown)), [markdown]);
  const keys = useMemo(() => course.lessons.map((l) => l.key), [course]);
  const key = storageKey(transactionId, fileId);

  // Read after mount so server and first client render agree.
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const saved = readProgress(key);
    setCompleted(saved);
    setIndex(progressSummary(keys, saved).firstIncomplete ?? 0);
    setLoaded(true);
  }, [key, keys]);

  const persist = (next: Set<string>) => {
    setCompleted(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(Array.from(next)));
    } catch {
      // Storage blocked (private mode) — progress just won't persist this visit.
    }
  };

  const headingRef = useRef<HTMLHeadingElement>(null);
  const goTo = (i: number) => {
    setIndex(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Move focus to the new lesson so keyboard and screen-reader users land on it.
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const summary = progressSummary(keys, completed);
  const lesson = course.lessons[index];
  const isLast = index === course.lessons.length - 1;
  const isDone = completed.has(lesson.key);
  const allDone = summary.done === summary.total;

  const markAndContinue = () => {
    const next = new Set(completed);
    next.add(lesson.key);
    persist(next);
    if (!isLast) goTo(index + 1);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        to="/success"
        search={{ id: transactionId }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Your downloads
      </Link>

      <header className="mt-4">
        {course.title ? (
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
            {course.title}
          </h1>
        ) : null}
        <div className="mt-3 flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={summary.total}
            aria-valuenow={summary.done}
            aria-label="Course progress"
          >
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${summary.percent}%` }} />
          </div>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {summary.done} of {summary.total} complete
          </span>
        </div>
      </header>

      <div className="mt-8 grid gap-8 md:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Lessons" className="md:sticky md:top-6 md:self-start">
          <ol className="flex flex-col gap-1">
            {course.lessons.map((l, i) => {
              const done = completed.has(l.key);
              const current = i === index;
              return (
                <li key={l.key}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                      current ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {done ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-label="Complete" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 opacity-40" aria-hidden="true" />
                    )}
                    <span className="min-w-0">{l.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <article className="min-w-0 max-w-[68ch]">
          {index === 0 && course.intro.length > 0 ? (
            <div className="mb-6 text-muted-foreground">
              <LessonContent blocks={course.intro} parseInline={parseInline} />
            </div>
          ) : null}
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Lesson {index + 1} of {course.lessons.length}
          </p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight outline-none sm:text-2xl"
          >
            {lesson.title}
          </h2>
          <div className="mt-5">
            <LessonContent blocks={lesson.blocks} parseInline={parseInline} />
          </div>

          {loaded && allDone ? (
            <div className="mt-8 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-medium">You finished the course.</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Every lesson stays here — come back to any of them from the list whenever you need it.
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <Button variant="outline" onClick={() => goTo(index - 1)} disabled={index === 0}>
              <ArrowLeft className="h-4 w-4" /> Previous
            </Button>
            {isDone ? (
              <Button variant="outline" onClick={() => goTo(index + 1)} disabled={isLast}>
                Next lesson <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={markAndContinue}>
                <Check className="h-4 w-4" /> {isLast ? "Mark complete" : "Complete & continue"}
              </Button>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}

function Notice({ title, body, backId }: { title: string; body: string; backId?: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {backId ? (
        <Link to="/success" search={{ id: backId }} className="mt-4 inline-block text-sm text-primary underline underline-offset-2">
          Back to your downloads
        </Link>
      ) : null}
    </div>
  );
}
