import { cn } from "@/lib/utils";

interface MetricProps {
  label: string;
  value: React.ReactNode;
  accentClass?: string;
  hint?: string;
}

export function Metric({ label, value, accentClass, hint }: MetricProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] tracking-[0.2em] text-suite-text-dim uppercase">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-sm tabular text-suite-text",
          accentClass,
        )}
      >
        {value}
      </span>
      {hint && (
        <span className="text-[10px] text-suite-text-dim">{hint}</span>
      )}
    </div>
  );
}
