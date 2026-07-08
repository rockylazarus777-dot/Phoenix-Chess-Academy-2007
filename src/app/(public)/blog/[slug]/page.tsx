import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { buildArticleSchema } from "@/lib/seo/article";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { TrialCTA } from "@/components/home/TrialCTA";
import { BlogContentRenderer } from "@/components/blog/BlogContentRenderer";
import { getBlogPosts, getBlogPostBySlug, getRelatedBlogPosts } from "@/content/blog";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return buildMetadata({
      title: "Article Not Found",
      description: "This article could not be found.",
      path: `/blog/${slug}`,
      index: false,
    });
  }

  return buildMetadata({
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt,
    path: `/blog/${post.slug}`,
    ogImage: post.coverImage,
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = getRelatedBlogPosts(post);
  const articleSchema = buildArticleSchema(post);

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Blog", href: "/blog" },
    { label: post.title, href: `/blog/${post.slug}` },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <Section className="pb-0">
        <Container>
          <Breadcrumbs items={breadcrumbItems} />
        </Container>
      </Section>

      <article>
        <Section>
          <Container className="max-w-3xl">
            <header>
              <p className="text-caption text-primary-text mb-3">{post.category}</p>
              <h1 className="text-h1 text-foreground">{post.title}</h1>
              <div className="text-body-sm text-muted-foreground mt-4 flex flex-wrap items-center gap-3">
                <span>{post.author}</span>
                <span aria-hidden>·</span>
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
                </time>
                {post.updatedAt ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      Updated{" "}
                      <time dateTime={post.updatedAt}>
                        {new Date(post.updatedAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
                      </time>
                    </span>
                  </>
                ) : null}
              </div>
            </header>

            {post.coverImage ? (
              <div className="relative mt-8 aspect-video overflow-hidden rounded-2xl border border-border">
                <Image
                  src={post.coverImage}
                  alt={post.coverImageAlt ?? post.title}
                  fill
                  sizes="(min-width: 1024px) 768px, 100vw"
                  priority
                  className="object-cover"
                />
              </div>
            ) : null}

            <div className="mt-8">
              <BlogContentRenderer content={post.content} />
            </div>

            {post.tags.length > 0 ? (
              <ul className="mt-10 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <li key={tag} className="rounded-full border border-border-strong px-3 py-1 text-caption text-muted-foreground">
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}
          </Container>
        </Section>
      </article>

      {relatedPosts.length > 0 ? (
        <Section surface>
          <Container>
            <p className="text-caption text-primary-text mb-3">Related Articles</p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="block rounded-2xl border border-border bg-surface p-5"
                >
                  <p className="text-caption text-primary-text">{related.category}</p>
                  <p className="text-h4 text-foreground mt-2">{related.title}</p>
                  <p className="text-body-sm text-muted-foreground mt-2">{related.excerpt}</p>
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      <TrialCTA />
    </>
  );
}
