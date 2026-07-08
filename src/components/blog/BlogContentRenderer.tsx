import type { BlogContentBlock } from "@/content/blog";

interface BlogContentRendererProps {
  content: BlogContentBlock[];
}

/**
 * Renders a post's typed content-block array as semantic HTML. There is
 * no Markdown parser and no `dangerouslySetInnerHTML` anywhere in this
 * component — every block type maps to a fixed, known-safe element, so
 * arbitrary HTML can never be injected through post content.
 */
export function BlogContentRenderer({ content }: BlogContentRendererProps) {
  return (
    <div className="prose-content max-w-none">
      {content.map((block, index) => {
        switch (block.type) {
          case "heading": {
            const Heading = block.level === 3 ? "h3" : "h2";
            return (
              <Heading key={index} className="text-h3 text-foreground mt-10 first:mt-0">
                {block.text}
              </Heading>
            );
          }
          case "list": {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
              <ListTag key={index} className="mt-4 list-inside list-disc space-y-2 text-body text-foreground/90">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ListTag>
            );
          }
          case "quote":
            return (
              <blockquote key={index} className="mt-6 border-l-2 border-primary pl-5 text-body-lg text-foreground italic">
                <p>{block.text}</p>
                {block.attribution ? (
                  <footer className="text-body-sm text-muted-foreground not-italic mt-2">— {block.attribution}</footer>
                ) : null}
              </blockquote>
            );
          case "paragraph":
          default:
            return (
              <p key={index} className="mt-4 text-body text-foreground/90 first:mt-0">
                {block.text}
              </p>
            );
        }
      })}
    </div>
  );
}
