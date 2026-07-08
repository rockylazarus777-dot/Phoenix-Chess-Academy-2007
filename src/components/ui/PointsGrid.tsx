interface Point {
  title: string;
  description: string;
}

interface PointsGridProps {
  points: Point[];
  columns?: 2 | 3;
}

/**
 * Bordered editorial points list — used for "Why Choose Phoenix" style
 * content wherever it appears (home page, About page) instead of a
 * generic icon-grid, and instead of duplicating the same markup twice.
 */
export function PointsGrid({ points, columns = 2 }: PointsGridProps) {
  return (
    <div
      className={
        columns === 3
          ? "grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
          : "grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2"
      }
    >
      {points.map((point) => (
        <div key={point.title} className="border-t border-border pt-6">
          <div className="h-px w-10 bg-primary mb-4" aria-hidden />
          <h3 className="text-h4 text-foreground">{point.title}</h3>
          <p className="text-body-sm text-muted-foreground mt-2">{point.description}</p>
        </div>
      ))}
    </div>
  );
}
