import Image from "next/image";
import type { Coach } from "@/content/coaches";

interface CoachCardProps {
  coach: Coach;
}

/**
 * Full coach card for the public /coaches page — richer than the compact
 * preview card used on the home page (FIDE rating, specializations,
 * languages, bio). Kept as its own domain component since the two cards
 * show meaningfully different amounts of information rather than forcing
 * one card to serve both contexts.
 */
export function CoachCard({ coach }: CoachCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-5">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border-strong">
          <Image src={coach.image} alt={coach.name} fill sizes="80px" className="object-cover" />
        </div>
        <div>
          <p className="text-h4 text-foreground">{coach.name}</p>
          <p className="text-body-sm text-muted-foreground">{coach.role}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {coach.chessTitle ? <span className="text-caption text-primary-text">{coach.chessTitle}</span> : null}
            {coach.fideRating ? (
              <span className="text-caption text-muted-foreground">FIDE {coach.fideRating}</span>
            ) : null}
          </div>
        </div>
      </div>

      <p className="text-body-sm text-muted-foreground mt-4">{coach.shortBio}</p>

      {coach.specializations && coach.specializations.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {coach.specializations.map((item) => (
            <li key={item} className="text-caption rounded-2xl border border-border px-2.5 py-1 text-muted-foreground">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
