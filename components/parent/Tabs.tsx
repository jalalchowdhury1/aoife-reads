"use client";

export interface TabDef {
  id: string;
  label: string;
  emoji?: string;
}

/**
 * Sticky top tab bar for the parent dashboard. Horizontal-scrolls on a
 * phone-width viewport instead of wrapping, so it stays one row on 360px.
 */
export function Tabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-teal-100 bg-cream/95 px-4 backdrop-blur">
      <div className="flex gap-1 overflow-x-auto py-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onChange(t.id)}
            className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              active === t.id ? "bg-teal-400 text-white" : "bg-teal-50 text-ink/70"
            }`}
          >
            {t.emoji ? `${t.emoji} ` : ""}
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Tabs;
