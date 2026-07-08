"use client";

import { developmentAreaValues } from "@/lib/validation/studentProgress";
import { DEVELOPMENT_AREA_LABELS, DEVELOPMENT_RATING_LABELS } from "@/lib/portal/developmentAreas";
import type { DevelopmentArea } from "@/lib/supabase/types";

export type AreaRatingsValue = Partial<Record<DevelopmentArea, { rating: number; comment: string }>>;

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

const chipClasses =
  "inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-md border px-2 text-body-sm font-medium focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring";

/**
 * Controlled editor for the ten canonical development-area ratings, shared
 * between the create and edit evaluation forms. No area is preselected and
 * no rating defaults to 3 — a coach must explicitly toggle an area on and
 * choose a rating (see docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Development
 * Area Form"). Rating controls are keyboard accessible (`fieldset`/
 * `legend`, labelled radio buttons showing both the number and its text
 * development label) and never communicate the rating by color alone. No
 * star/trophy/crown icons.
 */
export function DevelopmentAreaRatingsEditor({ value, onChange }: { value: AreaRatingsValue; onChange: (next: AreaRatingsValue) => void }) {
  function toggleArea(area: DevelopmentArea, active: boolean) {
    const next = { ...value };
    if (active) {
      next[area] = next[area] ?? { rating: 0, comment: "" };
    } else {
      delete next[area];
    }
    onChange(next);
  }

  function setRating(area: DevelopmentArea, rating: number) {
    onChange({ ...value, [area]: { rating, comment: value[area]?.comment ?? "" } });
  }

  function setComment(area: DevelopmentArea, comment: string) {
    onChange({ ...value, [area]: { rating: value[area]?.rating ?? 0, comment } });
  }

  return (
    <div className="flex flex-col gap-3">
      {developmentAreaValues.map((area) => {
        const entry = value[area];
        const active = entry !== undefined;
        return (
          <fieldset key={area} className="rounded-lg border border-border p-3">
            <legend className="flex items-center gap-2 text-body-sm font-medium text-foreground">
              <input
                type="checkbox"
                id={`area-toggle-${area}`}
                checked={active}
                onChange={(e) => toggleArea(area, e.target.checked)}
                className="h-4 w-4 rounded border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <label htmlFor={`area-toggle-${area}`}>{DEVELOPMENT_AREA_LABELS[area]}</label>
            </legend>

            {active ? (
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex flex-wrap gap-2" role="group" aria-label={`Rating for ${DEVELOPMENT_AREA_LABELS[area]}`}>
                  {RATING_VALUES.map((rating) => {
                    const inputId = `${area}-rating-${rating}`;
                    const checked = entry?.rating === rating;
                    return (
                      <label
                        key={rating}
                        htmlFor={inputId}
                        className={`${chipClasses} ${checked ? "border-primary bg-primary text-primary-foreground" : "border-border-strong text-foreground"}`}
                        title={DEVELOPMENT_RATING_LABELS[rating]}
                      >
                        <input
                          id={inputId}
                          type="radio"
                          name={`${area}-rating`}
                          className="sr-only"
                          checked={checked}
                          onChange={() => setRating(area, rating)}
                        />
                        {rating}
                      </label>
                    );
                  })}
                  <span className="self-center text-body-sm text-muted-foreground">
                    {entry && entry.rating > 0 ? DEVELOPMENT_RATING_LABELS[entry.rating as 1 | 2 | 3 | 4 | 5] : "Choose a rating"}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${area}-comment`} className="text-xs text-muted-foreground">
                    Comment (optional) — use a short chess-development comment only
                  </label>
                  <textarea
                    id={`${area}-comment`}
                    className="min-h-14 rounded-md border border-border-strong bg-surface px-3 py-2 text-body-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    maxLength={500}
                    value={entry?.comment ?? ""}
                    onChange={(e) => setComment(area, e.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}
