import { DEVELOPMENT_AREA_LABELS, getDevelopmentRatingLabel } from "@/lib/portal/developmentAreas";
import type { DevelopmentArea } from "@/lib/supabase/types";

/**
 * Read-only presentation of one development-area rating — used everywhere
 * an already-authorized evaluation's ratings are displayed (Coach
 * evaluation detail, Coach student progress history, Student/Parent
 * progress views). Deliberately no star icons (implies review/rating
 * semantics this project doesn't intend), no trophy/crown icons (implies
 * an official chess title/achievement this rating scale does not claim).
 * The numeric value is always shown alongside its text development label —
 * never color alone, never a bare number. See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Development Rating
 * Presentation".
 */
export function DevelopmentAreaRating({
  area,
  rating,
  comment,
}: {
  area: DevelopmentArea;
  rating: number;
  comment?: string | null;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-body-sm font-medium text-foreground">{DEVELOPMENT_AREA_LABELS[area]}</p>
        <p className="text-body-sm text-muted-foreground">
          {rating} / 5 — {getDevelopmentRatingLabel(rating)}
        </p>
      </div>
      {comment ? <p className="mt-2 text-body-sm text-muted-foreground">{comment}</p> : null}
    </div>
  );
}
