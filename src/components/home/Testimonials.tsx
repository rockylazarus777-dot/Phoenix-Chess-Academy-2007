import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { testimonials } from "@/content/home";

/**
 * Renders only when real testimonials exist — no fabricated quotes or
 * parent names. Section is entirely omitted otherwise.
 */
export function Testimonials() {
  if (testimonials.length === 0) return null;

  return (
    <Section elevated>
      <Container>
        <SectionHeader eyebrow="Testimonials" title="What parents and students say" align="center" className="mx-auto" />
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="rounded-2xl border border-border bg-surface p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="text-body text-foreground/90">&ldquo;{testimonial.quote}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3">
                {testimonial.image ? (
                  <div className="relative h-10 w-10 overflow-hidden rounded-full">
                    <Image src={testimonial.image} alt={testimonial.name} fill sizes="40px" className="object-cover" />
                  </div>
                ) : null}
                <div>
                  <p className="text-body-sm text-foreground">{testimonial.name}</p>
                  <p className="text-caption text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
