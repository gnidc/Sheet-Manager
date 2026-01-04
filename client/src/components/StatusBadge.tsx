import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'secondary' | 'accent' | 'success' | 'warning';
  className?: string;
}

export function StatusBadge({ children, variant = 'default', className }: StatusBadgeProps) {
  const variants = {
    default: "bg-primary/10 text-primary border-primary/20",
    outline: "bg-background border-border text-foreground",
    secondary: "bg-secondary text-secondary-foreground border-transparent",
    accent: "bg-accent/10 text-accent-foreground border-accent/20 dark:text-accent",
    success: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
