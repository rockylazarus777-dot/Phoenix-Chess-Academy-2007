import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { getBlogPosts } from "@/content/blog";

/**
 * No published articles exist yet — renders a simple CTA to /blog instead
 * of fabricating dated news history. Once src/content/blog.ts has
 * entries, up to 3 preview cards render automatically — the same
 * authoritative source as /blog.
 */
export function ResourcesPreview() {
  const resourceArticles = getBlogPosts();

  if (resourceArticles.length === 0) {
    return (
      <Section>
        <Container className="text-center">
          <SectionHeader
            eyebrow="Chess Resources"
            title="Guides, strategy notes, and academy news"
            align="center"
            className="mx-auto"
          />
          <div className="mt-8">
            <Button href="/blog" variant="outline" size="md">
              Visit Chess Resources
            </Button>
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <Section>
      <Container>
        <SectionHeader eyebrow="Chess Resources" title="Latest from Phoenix" />
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {resourceArticles.slice(0, 3).map((article) => (
            <Link key={article.slug} href={`/blog/${article.slug}`} className="block rounded-2xl border border-border bg-surface overflow-hidden">
              {article.coverImage ? (
                <div className="relative aspect-video">
                  <Image
                    src={article.coverImage}
                    alt={article.coverImageAlt ?? article.title}
                    fill
                    sizes="(min-width: 640px) 33vw, 100vw"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="p-5">
                <p className="text-caption text-primary-text">{article.category}</p>
                <p className="text-h4 text-foreground mt-2">{article.title}</p>
                <p className="text-body-sm text-muted-foreground mt-2">{article.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </Section>
  );
}
