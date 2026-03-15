"use client";

import { useMemo, useState } from "react";
import type { CoreModule, CoreModuleId } from "@/types/modules";
import { ModuleNotebookPanel } from "@/components/module-notebook-panel";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { TodaySummaryCard } from "@/components/today-summary-card";
import { useSummary } from "@/lib/use-signals";

type DesktopLiteShellProps = {
  modules: CoreModule[];
};

export function DesktopLiteShell({ modules }: DesktopLiteShellProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<CoreModuleId>("today");
  const { loading: summaryLoading, error: summaryError } = useSummary();

  const selectedModule = useMemo(() => {
    return modules.find((module) => module.id === selectedModuleId) ?? modules[0];
  }, [modules, selectedModuleId]);

  if (!selectedModule) {
    return null;
  }

  const connectionText = summaryLoading ? "Connecting..." : summaryError ? "Gateway offline" : "Gateway active";
  const connectionDot = summaryLoading ? "○" : summaryError ? "○" : "●";
  const connectionTone = summaryLoading || summaryError ? "text-textMuted" : "text-green-300";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8 md:px-8">
      <header className="rounded-2xl border border-slate-800 bg-panelSoft/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-textMuted">OPSBOARD V0.7</p>
        <h1 className="mt-2 text-xl font-semibold text-textPrimary">Desktop Lite</h1>
        <p className="mt-3 max-w-2xl text-sm text-textMuted">
        OpsBoard is for people who already run an AI.
        It works with any AI that can emit a signal — Claude, ChatGPT, Gemini, or your own.
        </p>
      </header>

      <section className="flex flex-col gap-4 md:flex-row">
        <div className="w-full md:w-56">
          <SidebarNavigation modules={modules} selectedModuleId={selectedModule.id} onSelect={setSelectedModuleId} />
          <p className={`mt-2 px-2 text-xs ${connectionTone}`}>
            {connectionDot} {connectionText}
          </p>
        </div>
        <div className="flex-1">
          {selectedModule.id === "today" ? (
            <TodaySummaryCard />
          ) : (
            <ModuleNotebookPanel module={selectedModule} />
          )}
        </div>
      </section>
    </main>
  );
}
