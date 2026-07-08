import { cn } from "@/lib/utils/cn";
import { tournamentStatusLabels, type TournamentStatus } from "@/content/tournaments";

export type { TournamentStatus };

// Status is communicated through label text + icon/dot shape, not color
// alone. Only CANCELLED and the live-pulse dot on LIVE use the danger
// color — DRAFT/REGISTRATION_CLOSED/COMPLETED intentionally share a
// neutral style rather than defaulting to red for every "closed" state.
const statusStyles: Record<TournamentStatus, string> = {
  DRAFT: "bg-surface-elevated text-muted-foreground border border-border",
  UPCOMING: "bg-surface-elevated text-foreground border border-border-strong",
  REGISTRATION_OPEN: "bg-success/15 text-success border border-success/40",
  REGISTRATION_CLOSED: "bg-surface-elevated text-muted-foreground border border-border",
  LIVE: "bg-danger/15 text-foreground border border-danger/50",
  COMPLETED: "bg-surface-elevated text-muted-foreground border border-border",
  CANCELLED: "bg-danger/10 text-danger border border-danger/40",
};

interface StatusBadgeProps {
  status: TournamentStatus;
  className?: string;
}

/** Status indicator for tournament cards/detail pages. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "text-caption inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1",
        statusStyles[status],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "LIVE" && "bg-danger animate-pulse",
          status === "REGISTRATION_OPEN" && "bg-success",
          status === "CANCELLED" && "bg-danger",
          (status === "UPCOMING" || status === "REGISTRATION_CLOSED" || status === "COMPLETED" || status === "DRAFT") &&
            "bg-muted-foreground",
        )}
      />
      {tournamentStatusLabels[status]}
    </span>
  );
}
