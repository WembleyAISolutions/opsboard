"use client";

import { useMemo, useState } from "react";
import type { CoreModule, CoreModuleId } from "@/types/modules";
import { ModuleNotebookPanel } from "@/components/module-notebook-panel";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { TodaySummaryCard } from "@/components/today-summary-card";
import { moduleSignals, todaySummary } from "@/lib/mock-data";

type DesktopLiteShellProps = {
  modules: CoreModule[];
};

export function DesktopLiteShell({ modules }: DesktopLiteShellProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<CoreModuleId>("today");

  const selectedModule = useMemo(() => {
    return modules.find((module) => module.id === selectedModuleId) ?? modules[0];
  }, [modules, selectedModuleId]);

  const selectedSignals = useMemo(() => {
    if (!selectedModule) {
      return [];
    }

    return moduleSignals[selectedModule.id] ?? [];
  }, [selectedModule]);

  if (!selectedModule) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8 md:px-8">
      <header className="rounded-2xl border border-slate-800 bg-panelSoft/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-textMuted">OpsBoard v0.1</p>
        <h1 className="mt-2 text-xl font-semibold text-textPrimary">Desktop Lite</h1>
        <p className="mt-3 max-w-2xl text-sm text-textMuted">
          Lightweight human-AI work gateway for ChatGPT-centered multi-agent workflows.
        </p>
      </header>

      <section className="flex flex-col gap-4 md:flex-row">
        <SidebarNavigation modules={modules} selectedModuleId={selectedModule.id} onSelect={setSelectedModuleId} />
        <div className="flex-1">
          {selectedModule.id === "today" ? (
            <TodaySummaryCard summary={todaySummary} />
          ) : (
            <ModuleNotebookPanel module={selectedModule} signals={selectedSignals} />
          )}
        </div>
      </section>
    </main>
  );
}
