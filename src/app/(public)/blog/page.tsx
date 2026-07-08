import Image from "next/image";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyDataState } from "@/components/ui/EmptyDataState";
import { TrialCTA } from "@/components/home/TrialCTA";
import { getBlogPosts, getFeaturedBlogPost, getBlogCategoriesInUse } from "@/content/blog";

export const metadata = buildMetadata({
  title: "Chess Resources",
  description: "Chess learning guides, training resources, and academy updates from Phoenix Chess Academy.",
  path: "/blog",
});

export default function BlogListingPage() {
  const posts = getBlogPosts();
  const featured = getFeaturedBlogPost();
  const categories = getBlogCategoriesInUse();
  const remainingPosts = featured ? posts.filter((post) => post.slug !== featured.slug) : posts;

  return (
    <>
      <PageHero
        eyebrow="Resources"
        title="Chess Resources"
        description="Guides, training notes, and academy updates for students, parents, and chess learners."
      />

      {posts.length === 0 ? (
        <EmptyDataState
          eyebrow="Chess Resources"
          title="Educational chess content, on the way"
          description="Phoenix is building a library of practical chess learning guides and academy updates. Real articles will be published here — this page will never be filled with generated content just to appear active."
          ctaLabel="Explore Programs"
          ctaHref="/programs"
        />
      ) : (
        <>
          {featured ? (
            <Section>
              <Container>
                <SectionHeader eyebrow="Featured Article" title="Latest from Phoenix" />
                <Link
                  href={`/blog/${featured.slug}`}
                  className="mt-8 grid grid-cols-1 gap-6 rounded-2xl border border-border bg-surface overflow-hidden lg:grid-cols-2"
                >
                  {featured.coverImage ? (
                    <div className="relative aspect-video lg:aspect-auto">
                      <Image
                        src={featured.coverImage}
                        alt={featured.coverImageAlt ?? featured.title}
                        fill
                        sizes="(min-width: 1024px) 50vw, 100vw"
                        loading="lazy"
                        className="object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="p-6 lg:p-8">
                    <p className="text-caption text-primary-text">{featured.category}</p>
                    <p className="text-h3 text-foreground mt-2">{featured.title}</p>
                    <p className="text-body-sm text-muted-foreground mt-3">{featured.excerpt}</p>
                  </div>
                </Link>
              </Container>
            </Section>
          ) : null}

          {remainingPosts.length > 0 ? (
            <Section surface>
              <Container>
                <SectionHeader eyebrow="More Articles" title="All Articles" />
                <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {remainingPosts.map((post) => (
                    <Link
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className="block rounded-2xl border border-border bg-surface overflow-hidden"
                    >
                      {post.coverImage ? (
                        <div className="relative aspect-video">
                          <Image
                            src={post.coverImage}
                            alt={post.coverImageAlt ?? post.title}
                            fill
                            sizes="(min-width: 640px) 33vw, 100vw"
                            loading="lazy"
                            className="object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="p-5">
                        <p className="text-caption text-primary-text">{post.category}</p>
                        <p className="text-h4 text-foreground mt-2">{post.title}</p>
                        <p className="text-body-sm text-muted-foreground mt-2">{post.excerpt}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </Container>
            </Section>
          ) : null}

          {categories.length > 1 ? (
            <Section>
              <Container>
                <SectionHeader eyebrow="Browse" title="Categories" />
                <div className="mt-6 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full border border-border-strong px-4 py-1.5 text-body-sm text-foreground"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </Container>
            </Section>
          ) : null}
        </>
      )}

      <TrialCTA />
    </>
  );
}
