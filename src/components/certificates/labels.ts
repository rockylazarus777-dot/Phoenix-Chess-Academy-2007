import type { CertificateType, AchievementType, CertificateDocumentStatus } from "@/lib/supabase/types";

/**
 * Deterministic certificate_type -> display label mapper. Every caller
 * (admin list/detail, student list/detail, parent list/detail) uses this
 * instead of rendering the raw enum value. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Certificate Type
 * Presentation".
 */
const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
  PROGRAM_COMPLETION: "Program Completion",
  PARTICIPATION: "Participation",
  TOURNAMENT_PARTICIPATION: "Tournament Participation",
  TOURNAMENT_ACHIEVEMENT: "Tournament Achievement",
  SPECIAL_RECOGNITION: "Special Recognition",
};

export function certificateTypeLabel(type: CertificateType): string {
  return CERTIFICATE_TYPE_LABELS[type];
}

/**
 * Deterministic achievement_type -> display label mapper. Never displays
 * the raw enum value. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Achievement Type
 * Presentation".
 */
const ACHIEVEMENT_TYPE_LABELS: Record<AchievementType, string> = {
  TOURNAMENT_WINNER: "Tournament Winner",
  TOURNAMENT_RUNNER_UP: "Tournament Runner-Up",
  TOURNAMENT_PLACEMENT: "Tournament Placement",
  CHESS_MILESTONE: "Chess Milestone",
  ACADEMY_RECOGNITION: "Academy Recognition",
  EXTERNAL_CHESS_ACHIEVEMENT: "External Chess Achievement",
};

export function achievementTypeLabel(type: AchievementType): string {
  return ACHIEVEMENT_TYPE_LABELS[type];
}

/**
 * Deterministic `certificate_documents.status` -> safe display label
 * (Phase 18) — Admin-only surface. FAILED never shows the raw
 * `generation_error_code`, R2/AWS/S3 error text, or a stack trace — only
 * this one fixed, safe sentence. See
 * docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Admin Certificate Document
 * History".
 */
const CERTIFICATE_DOCUMENT_STATUS_LABELS: Record<CertificateDocumentStatus, string> = {
  GENERATING: "Generating…",
  AVAILABLE: "Available",
  FAILED: "Certificate document generation failed.",
  SUPERSEDED: "Superseded",
};

export function certificateDocumentStatusLabel(status: CertificateDocumentStatus): string {
  return CERTIFICATE_DOCUMENT_STATUS_LABELS[status];
}

/** Human-readable file size (KB/MB) — never the raw byte count next to a misleading unit. Rounds to 1 decimal place. */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
