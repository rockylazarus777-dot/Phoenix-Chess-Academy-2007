import "server-only";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AdminAuditAction, UserRole } from "@/lib/supabase/types";
import type { AuthProfile } from "@/lib/auth/types";

/**
 * Thin wrapper around the `record_admin_audit` RPC (see
 * supabase/migrations/0014_admin_audit_and_functions.sql) — used by
 * every single-table admin mutation (update student, create parent,
 * change a status, etc.). Multi-table atomic creates use their own
 * `*_with_audit()` RPC instead (which writes the audit row in the same
 * transaction) — see docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Database
 * RPC Strategy" for the boundary between the two.
 *
 * KNOWN LIMITATION (documented, not a bug): this call happens AFTER the
 * business mutation has already committed, as a separate statement — it
 * is not in the same transaction. If the audit insert itself fails
 * (e.g. a transient network blip), the business mutation is NOT rolled
 * back; the failure is only logged. This is an accepted tradeoff for
 * Phase 10's single-table mutations (the audit log is an operational
 * record, not the source of truth for the business data itself) — see
 * "Audit Log Architecture" in the docs for the full reasoning.
 */
export async function recordAdminAudit(params: {
  actor: AuthProfile;
  action: AdminAuditAction;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = getAdminSupabaseClient();
    // See the `as never` note in src/lib/actions/contact.ts — same
    // supabase-js inference gap for hand-written Database types.
    await supabase.rpc("record_admin_audit", {
      p_actor_profile_id: params.actor.id,
      p_actor_role: params.actor.role as UserRole,
      p_action: params.action,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId,
      p_summary: params.summary,
      p_metadata: params.metadata ?? {},
    } as never);
  } catch {
    // Deliberately swallowed — see the KNOWN LIMITATION note above. The
    // caller's business mutation has already succeeded and must not be
    // reported as failed just because the audit write hiccupped.
    console.error("[admin-audit-write-failed]", { action: params.action, entityType: params.entityType });
  }
}
