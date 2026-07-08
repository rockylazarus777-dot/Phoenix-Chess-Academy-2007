import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { VideoFacade } from "@/components/home/VideoFacade";
import { getFeaturedVideo, getVideoThumbnail } from "@/content/videos";

/**
 * No real academy YouTube video ID has been supplied yet — rather than
 * hardcode a placeholder video, this renders a media-ready section
 * pointing to /videos. Once src/content/videos.ts has a featured entry,
 * the real facade (thumbnail + play button, iframe only after click)
 * renders — the same authoritative source as /videos.
 */
export function VideoExperience() {
  const featuredVideo = getFeaturedVideo();

  return (
    <Section surface>
      <Container className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeader
            eyebrow="Academy Video Experience"
            title="See Phoenix training in action"
            description="A closer look at how Phoenix students train, compete, and progress."
          />
          <div className="mt-8">
            <Button href="/videos" variant="outline" size="md">
              Watch More Videos
            </Button>
          </div>
        </div>

        {featuredVideo ? (
          <VideoFacade
            youtubeVideoId={featuredVideo.youtubeVideoId}
            title={featuredVideo.title}
            thumbnail={getVideoThumbnail(featuredVideo)}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-border-strong bg-background text-center">
            <p className="text-body-sm text-muted-foreground px-6">
              Academy video pending — added once a real Phoenix YouTube video ID is provided.
            </p>
          </div>
        )}
      </Container>
    </Section>
  );
}
