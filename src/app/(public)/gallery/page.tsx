import Image from "next/image";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyDataState } from "@/components/ui/EmptyDataState";
import { TrialCTA } from "@/components/home/TrialCTA";
import { GalleryClient } from "@/components/gallery/GalleryClient";
import { getGalleryItems, getFeaturedGalleryItems, getGalleryCategoriesInUse } from "@/content/gallery";

export const metadata = buildMetadata({
  title: "Gallery",
  description: "Photos from Phoenix Chess Academy training sessions, tournaments, and academy events.",
  path: "/gallery",
});

export default function GalleryPage() {
  const items = getGalleryItems();
  const featured = getFeaturedGalleryItems();
  const categories = getGalleryCategoriesInUse();

  return (
    <>
      <PageHero
        eyebrow="Media"
        title="Gallery"
        description="Photos from Phoenix Chess Academy training sessions, tournaments, and academy events."
      />

      {items.length === 0 ? (
        <EmptyDataState
          eyebrow="Phoenix Media"
          title="Academy photography, published as it's supplied"
          description="Original photos from Phoenix Chess Academy training sessions, tournaments, and events will appear here once they are provided — no stock or placeholder imagery is used."
          ctaLabel="View Tournaments"
          ctaHref="/tournaments"
        />
      ) : (
        <>
          {featured.length > 0 ? (
            <Section>
              <Container>
                <SectionHeader eyebrow="Featured" title="Featured Media" />
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {featured.slice(0, 3).map((item) => (
                    <div key={item.id} className="relative aspect-4/3 overflow-hidden rounded-2xl border border-border">
                      <Image
                        src={item.image}
                        alt={item.alt}
                        fill
                        sizes="(min-width: 1024px) 33vw, 100vw"
                        loading="lazy"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </Container>
            </Section>
          ) : null}

          <Section surface>
            <Container>
              <SectionHeader eyebrow="Full Gallery" title="Academy Media" />
              <div className="mt-10">
                <GalleryClient items={items} categories={categories} />
              </div>
            </Container>
          </Section>
        </>
      )}

      <TrialCTA />
    </>
  );
}
