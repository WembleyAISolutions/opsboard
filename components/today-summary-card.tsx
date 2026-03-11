import type { TodaySummary, WeekSummary } from "@/types/signal";
import { ModulePill } from "@/ui/module-pill";

type TodaySummaryCardProps = {
  todaySummary: TodaySummary;
  weekSummary: WeekSummary;
};

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

export function TodaySummaryCard({ todaySummary, weekSummary }: TodaySummaryCardProps) {
  const todayItems = [
    { id: "approvals-waiting", label: "approvals waiting", count: todaySummary.approvalsWaiting },
    { id: "signals-needing-review", label: "signals needing review", count: todaySummary.signalsNeedingReview },
    { id: "inbox-items", label: "inbox items", count: todaySummary.inboxItems }
  ];

  const weekItems = [
    { id: "items-in-progress", label: "items in progress", count: weekSummary.itemsInProgress },
    { id: "waiting-approval", label: "waiting approval", count: weekSummary.waitingApproval },
    { id: "completed", label: "completed", count: weekSummary.completed }
  ];

  return (
    <article className="rounded-xl border border-slate-700 bg-panel p-4 shadow-lg shadow-black/20">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-textPrimary">Today</h3>
        <ModulePill tone="normal" state="active" />
      </div>

      <div className="space-y-5">
        <CountSection title="Today" items={todayItems} />
        <CountSection title="This Week" items={weekItems} />
      </div>
    </article>
  );
}
