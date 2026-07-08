/**
 * "Download Certificate PDF" link — the ONLY place in the entire app
 * that points at `/api/certificates/[certificateId]/download`. Renders a
 * plain `<a>` (never `next/link`'s `<Link>`) because this href resolves
 * to a binary PDF response with `Content-Disposition: attachment`, not
 * an app page — a soft client-side navigation is the wrong behavior
 * here; a full browser navigation is what triggers the file download.
 *
 * Shared by the Student and Parent certificate detail pages. Explicit,
 * descriptive button text (no icon-only button) — see
 * docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Accessibility".
 */
export function DownloadCertificateLink({ certificateId }: { certificateId: string }) {
  return (
    <a
      href={`/api/certificates/${certificateId}/download`}
      className="text-button inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-sm bg-primary px-6 text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
    >
      Download Certificate PDF
    </a>
  );
}
