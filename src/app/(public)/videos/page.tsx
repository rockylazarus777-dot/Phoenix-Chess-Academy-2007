import { buildMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyDataState } from "@/components/ui/EmptyDataState";
import { VideoFacade } from "@/components/home/VideoFacade";
import { TrialCTA } from "@/components/home/TrialCTA";
import { VideoGridClient } from "@/components/videos/VideoGridClient";
import { getVideos, getFeaturedVideo, getVideoCategoriesInUse, getVideoThumbnail } from "@/content/videos";

export const metadata = buildMetadata({
  title: "Videos",
  description: "Watch Phoenix Chess Academy training, tournaments, and student experiences.",
  path: "/videos",
});

export default function VideosPage() {
  const videos = getVideos();
  const featured = getFeaturedVideo();
  const categories = getVideoCategoriesInUse();
  const remainingVideos = featured ? videos.filter((video) => video.id !== featured.id) : videos;

  return (
    <>
      <PageHero
        eyebrow="Media"
        title="Videos"
        description="A closer look at how Phoenix students train, compete, and progress."
      />

      {videos.length === 0 ? (
        <EmptyDataState
          eyebrow="Phoenix Video"
          title="Video experiences, published as they're supplied"
          description="Training footage, tournament moments, and student experiences will appear here once real Phoenix video content is provided — no placeholder or unrelated video content is used."
          ctaLabel="View Gallery"
          ctaHref="/gallery"
        />
      ) : (
        <>
          {featured ? (
            <Section>
              <Container className="max-w-3xl">
                <SectionHeader eyebrow="Featured" title="Featured Video" align="center" className="mx-auto" />
                <div className="mt-8">
                  <VideoFacade
                    youtubeVideoId={featured.youtubeVideoId}
                    title={featured.title}
                    thumbnail={getVideoThumbnail(featured)}
                  />
                  <p className="text-body-sm text-muted-foreground mt-3 text-center">{featured.description}</p>
                </div>
              </Container>
            </Section>
          ) : null}

          {remainingVideos.length > 0 ? (
            <Section surface>
              <Container>
                <SectionHeader eyebrow="All Videos" title="Video Library" />
                <div className="mt-10">
                  <VideoGridClient videos={remainingVideos} categories={categories} />
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
