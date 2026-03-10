import type { TodaySummary } from "@/types/modules";
import { ModulePill } from "@/ui/module-pill";

type TodaySummaryCardProps = {
  summary: TodaySummary;
};

type CountSectionProps = {
  title: string;
  items: TodaySummary["today"];
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

export function TodaySummaryCard({ summary }: TodaySummaryCardProps) {
  return (
    <article className="rounded-xl border border-slate-700 bg-panel p-4 shadow-lg shadow-black/20">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-textPrimary">Today</h3>
        <ModulePill tone="normal" state="active" />
      </div>

      <div className="space-y-5">
        <CountSection title="Today" items={summary.today} />
        <CountSection title="This Week" items={summary.thisWeek} />
      </div>
    </article>
  );
}
