import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { hasPermission } from "@/lib/auth/permissions";
import { listStaffProfiles } from "@/lib/queries/admin/accounts";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { AccountSearchPanel } from "@/components/admin/accounts/AccountSearchPanel";
import { StaffRoleTable } from "@/components/admin/accounts/StaffRoleTable";

export const metadata = buildMetadata({ title: "Accounts", description: "Portal account provisioning.", path: "/admin/accounts", index: false });

export default async function AdminAccountsPage() {
  const profile = await requirePermission("MANAGE_ACCOUNTS");
  const canManageRoles = hasPermission(profile.role, "MANAGE_ROLES");

  const staffResult = canManageRoles ? await listStaffProfiles() : null;

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title="Accounts" description="Invite portal accounts for existing student, parent, and coach records, and manage their active status." />

      <AccountSearchPanel />

      {canManageRoles ? (
        staffResult && staffResult.ok ? (
          <StaffRoleTable profiles={staffResult.data} />
        ) : staffResult ? (
          <AdminQueryError code={staffResult.code} />
        ) : null
      ) : null}
    </div>
  );
}
