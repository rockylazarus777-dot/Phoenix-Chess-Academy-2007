import type { Role } from "@/lib/auth/roles";

/**
 * Narrow authenticated-profile shape passed around server code and, when
 * genuinely needed, down to a Client Component (e.g. the protected shell
 * showing a name). Deliberately not the full `profiles` row — no
 * `created_at`/`updated_at`, no internal audit fields — so a future
 * accidental console.log or client prop never leaks more than these five
 * fields.
 */
export interface AuthProfile {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: Role;
  active: boolean;
}
