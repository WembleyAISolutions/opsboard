import type { CoreModule } from "@/types/modules";
import { ModuleCard } from "@/components/module-card";
import { TodaySummaryCard } from "@/components/today-summary-card";
import { todaySummary } from "@/lib/mock-data";

type DesktopLiteShellProps = {
  modules: CoreModule[];
};

export function DesktopLiteShell({ modules }: DesktopLiteShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-8">
      <header className="rounded-2xl border border-slate-800 bg-panelSoft/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-textMuted">OpsBoard v0.1</p>
        <h1 className="mt-2 text-2xl font-semibold text-textPrimary">Desktop Lite</h1>
        <p className="mt-3 max-w-2xl text-sm text-textMuted">
          Lightweight human-AI work gateway for ChatGPT-centered multi-agent workflows.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {modules.map((module) => (
          module.id === "today" ? <TodaySummaryCard key={module.id} summary={todaySummary} /> : <ModuleCard key={module.id} module={module} />
        ))}
      </section>
    </main>
  );
}
