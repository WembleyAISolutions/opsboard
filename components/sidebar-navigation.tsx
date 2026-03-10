import type { CoreModule, CoreModuleId } from "@/types/modules";

type SidebarNavigationProps = {
  modules: CoreModule[];
  selectedModuleId: CoreModuleId;
  onSelect: (moduleId: CoreModuleId) => void;
};

export function SidebarNavigation({ modules, selectedModuleId, onSelect }: SidebarNavigationProps) {
  return (
    <aside className="w-full rounded-2xl border border-slate-800 bg-panelSoft/40 p-3 md:w-56 md:p-4">
      <p className="mb-4 px-2 text-xs uppercase tracking-[0.2em] text-textMuted">OpsBoard Lite</p>
      <nav aria-label="Module navigation" className="space-y-1">
        {modules.map((module) => {
          const isSelected = module.id === selectedModuleId;
          return (
            <button
              key={module.id}
              type="button"
              onClick={() => onSelect(module.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                isSelected
                  ? "border border-slate-600 bg-slate-800/70 text-textPrimary"
                  : "border border-transparent text-textMuted hover:border-slate-700 hover:bg-slate-900/40 hover:text-textPrimary"
              }`}
            >
              {module.name}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
