import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { TournamentCategory } from "@/content/tournaments";

interface TournamentCategoriesProps {
  categories?: TournamentCategory[];
}

/**
 * Renders only configured category details — never assumes an age or
 * rating restriction that wasn't explicitly configured (no invented
 * "Under 8 / Under 10" categories).
 */
export function TournamentCategories({ categories }: TournamentCategoriesProps) {
  if (!categories || categories.length === 0) return null;

  return (
    <Section surface>
      <Container>
        <SectionHeader eyebrow="Categories" title="Tournament categories" />
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const ageRange =
              category.ageMin || category.ageMax
                ? `Age ${category.ageMin ?? "—"}${category.ageMax ? `–${category.ageMax}` : "+"}`
                : null;
            const ratingRange =
              category.ratingMin || category.ratingMax
                ? `Rating ${category.ratingMin ?? "—"}${category.ratingMax ? `–${category.ratingMax}` : "+"}`
                : null;

            return (
              <div key={category.id} className="border-t border-border pt-5">
                <h3 className="text-h4 text-foreground">{category.name}</h3>
                {category.description ? (
                  <p className="text-body-sm text-muted-foreground mt-2">{category.description}</p>
                ) : null}
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-muted-foreground">
                  {ageRange ? <li>{ageRange}</li> : null}
                  {category.genderRestriction ? <li>{category.genderRestriction}</li> : null}
                  {ratingRange ? <li>{ratingRange}</li> : null}
                  {typeof category.entryFee === "number" ? <li>₹{category.entryFee}</li> : null}
                  {typeof category.maxParticipants === "number" ? <li>Max {category.maxParticipants} players</li> : null}
                </ul>
              </div>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
