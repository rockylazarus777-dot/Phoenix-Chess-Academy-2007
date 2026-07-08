export interface TimelineEntry {
  year: number;
  title: string;
  description: string;
}

interface TimelineProps {
  entries: TimelineEntry[];
}

/**
 * Renders nothing when there are no confirmed entries — never shows
 * placeholder years. Once real milestones exist, they render as a simple
 * vertical, gold-accented timeline.
 */
export function Timeline({ entries }: TimelineProps) {
  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => a.year - b.year);

  return (
    <ol className="space-y-10 border-l border-border pl-8">
      {sorted.map((entry) => (
        <li key={`${entry.year}-${entry.title}`} className="relative">
          <span className="absolute -left-[2.35rem] top-1 h-3 w-3 rounded-full bg-primary" aria-hidden />
          <p className="text-caption text-primary-text">{entry.year}</p>
          <p className="text-h4 text-foreground mt-1">{entry.title}</p>
          <p className="text-body-sm text-muted-foreground mt-2">{entry.description}</p>
        </li>
      ))}
    </ol>
  );
}
