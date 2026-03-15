import { ModulePill } from "@/ui/module-pill";
import { useSummary } from "@/lib/use-signals";

type CountSectionProps = {
  title: string;
  items: Array<{ id: string; label: string; count: number }>;
};

function CountSection({ title, items }: CountSectionProps) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-textMuted">{title}</h4>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between text-sm">
            <span className="text-textMuted">{item.label}</span>
            <span className="rounded-md border border-slate-700 px-2 py-0.5 font-medium text-textPrimary">{item.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TodaySummaryCard() {
  const { summary, loading } = useSummary();

  const todayItems = [
    { id: "approvals-waiting", label: "approvals waiting", count: summary?.today.approvals_waiting ?? 0 },
    { id: "signals-needing-review", label: "signals needing review", count: summary?.today.signals_needing_review ?? 0 },
    { id: "inbox-items", label: "inbox items", count: summary?.today.inbox_items ?? 0 }
  ];

  const weekItems = [
    { id: "items-in-progress", label: "items in progress", count: summary?.this_week.in_progress ?? 0 },
    { id: "waiting-approval", label: "waiting approval", count: summary?.this_week.waiting_approval ?? 0 },
    { id: "completed", label: "completed", count: summary?.this_week.completed ?? 0 }
  ];

  const sourceText = Object.entries(summary?.source_breakdown ?? {})
    .filter(([, count]) => count > 0)
    .map(([source, count]) => `${source} · ${count}`)
    .join("  ");

  return (
    <article className="rounded-xl border border-slate-700 bg-panel p-4 shadow-lg shadow-black/20">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-textPrimary">Today</h3>
        <ModulePill tone="normal" state="active" />
      </div>

      <div className={`space-y-5 ${loading ? "opacity-70" : ""}`}>
        <CountSection title="Today" items={todayItems} />
        <CountSection title="This Week" items={weekItems} />
        {sourceText ? <p className="text-xs text-textMuted">{sourceText}</p> : null}
      </div>
    </article>
  );
}
