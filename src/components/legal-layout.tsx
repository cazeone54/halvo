import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";

export function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{title}</h1>
        <div className="mt-3 rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
          Placeholder legal text — have a lawyer review this before real launch. Not legal advice.
        </div>
        <div className="prose prose-sm mt-6 max-w-none text-foreground [&_h2]:mt-6 [&_h2]:font-[family-name:var(--font-display)] [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-2 [&_p]:text-sm [&_p]:text-muted-foreground">
          {children}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
