import type { AdminCertificateDocumentRow } from "@/lib/supabase/types";
import { certificateDocumentStatusLabel, formatFileSize } from "@/components/certificates/labels";

/**
 * Admin certificate document version history (Phase 18). Never renders
 * storage_key/storage_bucket/sha256_checksum/generated_by — those
 * columns are not even part of `AdminCertificateDocumentRow`. FAILED
 * rows show only the safe mapped text via `certificateDocumentStatusLabel`
 * — never the raw `generation_error_code`. Stacked cards on narrow
 * viewports instead of a forced-wide table — see
 * docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Admin Certificate Document
 * History" and "Responsive QA".
 */
export function CertificateDocumentHistory({ documents }: { documents: AdminCertificateDocumentRow[] }) {
  if (documents.length === 0) {
    return <p className="text-body-sm text-muted-foreground">No certificate documents have been generated yet.</p>;
  }

  const latestVersion = Math.max(...documents.map((doc) => doc.version));

  return (
    <ul className="flex flex-col gap-3">
      {documents
        .slice()
        .sort((a, b) => b.version - a.version)
        .map((doc) => (
          <li key={doc.document_id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body-sm font-medium text-foreground">Version {doc.version}</span>
              {doc.version === latestVersion ? (
                <span className="inline-block rounded-full border border-border-strong px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Current / Latest
                </span>
              ) : null}
            </div>
            <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Status</dt>
                <dd className="text-body-sm text-foreground">{certificateDocumentStatusLabel(doc.status)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Generated</dt>
                <dd className="text-body-sm text-foreground">{doc.generated_at ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">File size</dt>
                <dd className="text-body-sm text-foreground">{formatFileSize(doc.file_size_bytes)}</dd>
              </div>
            </dl>
          </li>
        ))}
    </ul>
  );
}
