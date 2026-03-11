"use client";

import { useEffect, useMemo, useState } from "react";
import type { CoreModule, CoreModuleId } from "@/types/modules";
import { ModuleNotebookPanel } from "@/components/module-notebook-panel";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { TodaySummaryCard } from "@/components/today-summary-card";
import { mockProducerSignals } from "@/lib/mock-data";
import { createSignalEngine } from "@/lib/signal-engine";
import { ingestLocalProducerSignals } from "@/lib/signal-producer-transport";
import type { LocalSignalAction } from "@/types/signal";

type DesktopLiteShellProps = {
  modules: CoreModule[];
};

export function DesktopLiteShell({ modules }: DesktopLiteShellProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<CoreModuleId>("today");
  const [engineVersion, setEngineVersion] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const engine = useMemo(() => createSignalEngine(), []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await ingestLocalProducerSignals(mockProducerSignals, engine);
      if (!cancelled) {
        setIsLoaded(true);
        setEngineVersion((value) => value + 1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [engine]);

  const selectedModule = useMemo(() => {
    return modules.find((module) => module.id === selectedModuleId) ?? modules[0];
  }, [modules, selectedModuleId]);

  const todaySummary = useMemo(() => engine.getTodaySummary(), [engine, engineVersion]);
  const weekSummary = useMemo(() => engine.getWeekSummary(), [engine, engineVersion]);

  const selectedSignals = useMemo(() => {
    if (!selectedModule || selectedModule.id === "today") {
      return [];
    }
    return engine.getSignalsByModule(selectedModule.id);
  }, [engine, engineVersion, selectedModule]);

  const deadCount = useMemo(() => engine.getDeadSignals().length, [engine, engineVersion]);
  const warningCount = useMemo(() => engine.getWarnings().length, [engine, engineVersion]);

  function handleSignalAction(signalId: string, action: LocalSignalAction): void {
    engine.applyLocalAction(signalId, action);
    setEngineVersion((value) => value + 1);
  }

  if (!selectedModule) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8 md:px-8">
      <header className="rounded-2xl border border-slate-800 bg-panelSoft/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-textMuted">OpsBoard v0.1</p>
        <h1 className="mt-2 text-xl font-semibold text-textPrimary">Desktop Lite</h1>
        <p className="mt-3 max-w-2xl text-sm text-textMuted">
          Lightweight human-AI work gateway for central-AI multi-agent workflows.
        </p>
        <p className="mt-2 text-xs text-textMuted">
          Dead signals: {deadCount} · Validation warnings: {warningCount}
        </p>
      </header>

      <section className="flex flex-col gap-4 md:flex-row">
        <SidebarNavigation modules={modules} selectedModuleId={selectedModule.id} onSelect={setSelectedModuleId} />
        <div className="flex-1">
          {!isLoaded ? (
            <article className="rounded-xl border border-slate-700 bg-panel p-4 text-sm text-textMuted">Loading local signals...</article>
          ) : selectedModule.id === "today" ? (
            <TodaySummaryCard todaySummary={todaySummary} weekSummary={weekSummary} />
          ) : (
            <ModuleNotebookPanel module={selectedModule} signals={selectedSignals} onAction={handleSignalAction} />
          )}
        </div>
      </section>
    </main>
  );
}
