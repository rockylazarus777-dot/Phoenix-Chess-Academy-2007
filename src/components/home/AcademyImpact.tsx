import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { academyLocations } from "@/content/impact";
import { trustStats } from "@/content/home";

/**
 * Architecture-ready academy impact section. Renders a real world map /
 * location grid once `academyLocations` has confirmed entries — for now
 * it renders only what's already verified (student count, online
 * coaching availability) rather than a fake map with invented countries.
 */
export function AcademyImpact() {
  const studentStat = trustStats.find((stat) => stat.id === "students");

  return (
    <Section surface>
      <Container>
        <SectionHeader
          eyebrow="Academy Reach"
          title="Training students in person and online"
          align="center"
          className="mx-auto"
          description={
            studentStat
              ? `${studentStat.value.toLocaleString()}${studentStat.suffix ?? ""} students trained, with a dedicated online coaching program for students who can't train in person.`
              : "A dedicated online coaching program for students who can't train in person."
          }
        />

        {academyLocations.length > 0 ? (
          <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {academyLocations.map((location) => (
              <div
                key={`${location.city}-${location.country}`}
                className="rounded-2xl border border-border bg-background p-5 text-center"
              >
                <p className="text-body text-foreground">{location.city}</p>
                <p className="text-body-sm text-muted-foreground">
                  {location.state ? `${location.state}, ` : ""}
                  {location.country}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
