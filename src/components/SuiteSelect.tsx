import * as React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SuiteOption<T extends string> {
  value: T;
  label: string;
  group?: string;
  /** Optional mark rendered before the label (e.g. a Netflix logo). */
  icon?: React.ReactNode;
}

interface SuiteSelectProps<T extends string> {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: SuiteOption<T>[];
  accentClass?: string;
  className?: string;
}

export function SuiteSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  accentClass,
  className,
}: SuiteSelectProps<T>) {
  // Group options if any have a group key.
  const grouped = options.reduce<Record<string, SuiteOption<T>[]>>((acc, opt) => {
    const k = opt.group ?? "";
    (acc[k] = acc[k] || []).push(opt);
    return acc;
  }, {});
  const groupKeys = Object.keys(grouped);
  const isGrouped = !(groupKeys.length === 1 && groupKeys[0] === "");
  const selected = options.find((o) => o.value === value);

  const renderItem = (o: SuiteOption<T>) => (
    <SelectItem
      key={o.value}
      value={o.value}
      className="text-suite-text data-[highlighted]:bg-suite-panel-elevated data-[highlighted]:text-suite-text focus:bg-suite-panel-elevated focus:text-suite-text"
    >
      <span className="flex items-center gap-2">
        {o.icon ? <span className="flex w-3.5 justify-center">{o.icon}</span> : null}
        <span>{o.label}</span>
      </span>
    </SelectItem>
  );

  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[10px] tracking-[0.18em] text-suite-text-muted uppercase">
        {label}
      </span>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger
          className={cn(
            "h-auto w-full bg-suite-bg border-suite-border text-suite-text",
            "px-3 py-2 text-sm rounded-sm",
            "hover:border-suite-border-strong focus:border-suite-text-muted focus:ring-0 focus:ring-offset-0",
            "transition-colors [&>span]:line-clamp-1",
            accentClass,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.icon ? (
              <span className="flex w-3.5 shrink-0 justify-center">{selected.icon}</span>
            ) : null}
            <span className="truncate">{selected?.label ?? ""}</span>
          </span>
        </SelectTrigger>
        <SelectContent className="bg-suite-panel border-suite-border text-suite-text">
          {isGrouped
            ? groupKeys.map((g) => (
                <SelectGroup key={g}>
                  <SelectLabel className="pl-2 text-[10px] uppercase tracking-[0.18em] text-suite-text-muted">
                    {g}
                  </SelectLabel>
                  {grouped[g].map(renderItem)}
                </SelectGroup>
              ))
            : grouped[""].map(renderItem)}
        </SelectContent>
      </Select>
    </label>
  );
}
