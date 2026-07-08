"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeStaffRole } from "@/lib/actions/admin/accounts";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { selectClasses } from "@/components/admin/forms/FormField";
import type { StaffProfileRow } from "@/lib/queries/admin/accounts";

/**
 * SUPER_ADMIN-only role management. Only STAFF/ADMIN rows get an
 * editable role control — a SUPER_ADMIN row is shown read-only (never
 * offered a dropdown), since changeStaffRole() refuses to touch
 * anything but an existing STAFF/ADMIN target. See
 * src/lib/actions/admin/accounts.ts.
 */
export function StaffRoleTable({ profiles }: { profiles: StaffProfileRow[] }) {
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(profileId: string, role: "STAFF" | "ADMIN") {
    startTransition(async () => {
      const result = await changeStaffRole({ profileId, role });
      setNotice(result.success ? { tone: "success", message: "Role updated." } : { tone: "error", message: result.message ?? "Something went wrong." });
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <h2 className="text-body font-medium text-foreground">Staff &amp; admin accounts</h2>
      <p className="mt-1 text-body-sm text-muted-foreground">Only STAFF and ADMIN roles can be changed here. SUPER_ADMIN assignment is not available in this phase.</p>

      {notice ? <div className="mt-3"><FormNotice tone={notice.tone} message={notice.message} /></div> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-body-sm">
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">Name</th>
              <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">Email</th>
              <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">Role</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-foreground">{profile.full_name ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{profile.email ?? "—"}</td>
                <td className="px-3 py-2">
                  {profile.role === "SUPER_ADMIN" ? (
                    <span className="text-muted-foreground">SUPER_ADMIN</span>
                  ) : (
                    <select
                      className={`${selectClasses} h-9 py-0`}
                      value={profile.role}
                      disabled={pending}
                      onChange={(e) => handleChange(profile.id, e.target.value as "STAFF" | "ADMIN")}
                    >
                      <option value="STAFF">STAFF</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
