import type { TournamentCategory, TournamentResultRow } from "@/content/tournaments";

interface TournamentResultsTableProps {
  results: TournamentResultRow[];
  categories?: TournamentCategory[];
}

/**
 * Responsive results display: a full table on sm+ screens, and stacked
 * rows with core columns (rank/player/score) plus visible (not
 * hover-only) secondary details on mobile — never an unreadable
 * 900px-wide table squeezed onto a phone.
 */
export function TournamentResultsTable({ results, categories }: TournamentResultsTableProps) {
  const categoryName = (id?: string) => categories?.find((category) => category.id === id)?.name;

  return (
    <div>
      <table className="hidden w-full text-body-sm sm:table">
        <thead>
          <tr className="border-b border-border text-left text-caption text-muted-foreground">
            <th scope="col" className="py-3 pr-4">Rank</th>
            <th scope="col" className="py-3 pr-4">Player</th>
            <th scope="col" className="py-3 pr-4">Category</th>
            <th scope="col" className="py-3 pr-4">Score</th>
            <th scope="col" className="py-3 pr-4">Tie-Break</th>
            <th scope="col" className="py-3 pr-4">Rating</th>
            <th scope="col" className="py-3">Prize</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <tr key={`${row.rank}-${row.playerName}`} className="border-b border-border">
              <td className="py-3 pr-4 text-foreground">{row.rank}</td>
              <td className="py-3 pr-4 text-foreground">{row.playerName}</td>
              <td className="py-3 pr-4 text-muted-foreground">{categoryName(row.categoryId) ?? "—"}</td>
              <td className="py-3 pr-4 text-foreground">{row.score}</td>
              <td className="py-3 pr-4 text-muted-foreground">{row.tieBreaks ?? "—"}</td>
              <td className="py-3 pr-4 text-muted-foreground">{row.rating ?? "—"}</td>
              <td className="py-3 text-muted-foreground">{row.prize ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-border border-y border-border sm:hidden">
        {results.map((row) => (
          <li key={`${row.rank}-${row.playerName}-mobile`} className="py-4">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-body text-foreground">
                <span className="text-primary-text">#{row.rank}</span> {row.playerName}
              </p>
              <p className="shrink-0 text-body text-foreground">{row.score}</p>
            </div>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-muted-foreground">
              {categoryName(row.categoryId) ? (
                <div>
                  <dt className="inline">Category: </dt>
                  <dd className="inline">{categoryName(row.categoryId)}</dd>
                </div>
              ) : null}
              {row.tieBreaks ? (
                <div>
                  <dt className="inline">Tie-Break: </dt>
                  <dd className="inline">{row.tieBreaks}</dd>
                </div>
              ) : null}
              {row.rating ? (
                <div>
                  <dt className="inline">Rating: </dt>
                  <dd className="inline">{row.rating}</dd>
                </div>
              ) : null}
              {row.prize ? (
                <div>
                  <dt className="inline">Prize: </dt>
                  <dd className="inline">{row.prize}</dd>
                </div>
              ) : null}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
