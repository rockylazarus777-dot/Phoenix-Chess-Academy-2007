import { requireRole } from "@/lib/auth/requireRole";
import { PORTAL_ALLOWED_ROLES } from "@/lib/auth/roles";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * /admin — STAFF, ADMIN, or SUPER_ADMIN. See src/app/portal/layout.tsx
 * for the full authorization contract this shares.
 *
 * PHASE 10: replaces the generic ProtectedShell placeholder with the
 * real admin operations shell (sidebar/topbar/mobile drawer). This
 * layout-level role check is necessary but NOT sufficient authorization
 * for mutations — every admin Server Action independently calls
 * requirePermission() (src/lib/auth/permissions.ts); this layout only
 * keeps non-admin roles out of the /admin route tree and renders the
 * permission-aware nav shell.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(PORTAL_ALLOWED_ROLES.admin);

  return <AdminShell profile={profile}>{children}</AdminShell>;
}
