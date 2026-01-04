import { cn } from "@/lib/utils";

interface DataCardProps {
  label: string;
  value: string | number | undefined | null;
  subValue?: string;
  className?: string;
  icon?: React.ReactNode;
}

export function DataCard({ label, value, subValue, className, icon }: DataCardProps) {
  return (
    <div className={cn(
      "p-5 rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow",
      className
    )}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {icon && <div className="text-muted-foreground/50">{icon}</div>}
      </div>
      <div className="text-2xl font-bold font-display tracking-tight text-foreground">
        {value || "—"}
      </div>
      {subValue && (
        <p className="text-sm text-muted-foreground mt-1">{subValue}</p>
      )}
    </div>
  );
}
