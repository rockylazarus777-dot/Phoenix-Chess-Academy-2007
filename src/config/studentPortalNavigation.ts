/**
 * The ONLY student portal nav items. Phase 14 added "Attendance" because
 * the real `/portal/attendance` route exists; Phase 15 added "Progress"
 * because the real `/portal/progress` route exists; Phase 16 added
 * "Assignments" because the real `/portal/assignments` route exists;
 * Phase 17 adds "Certificates" and "Achievements" because the real
 * `/portal/certificates` and `/portal/achievements` routes now exist. No
 * item links to Payments/Messages/Tournaments — those systems don't exist
 * yet, and this project explicitly does not show them as disabled/
 * "Coming Soon" entries either. See docs/STUDENT_PORTAL_ARCHITECTURE.md,
 * "Student Navigation", docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md,
 * "Student Attendance Route", docs/STUDENT_PROGRESS_ARCHITECTURE.md,
 * "Student Progress Route", docs/ASSIGNMENTS_ARCHITECTURE.md, "Student
 * Assignment Routes", and docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md,
 * "Student Certificate Routes" / "Student Achievement Routes".
 */
export interface StudentNavItem {
  href: string;
  label: string;
}

export const STUDENT_NAV_ITEMS: StudentNavItem[] = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/profile", label: "My Profile" },
  { href: "/portal/programs", label: "My Programs" },
  { href: "/portal/batches", label: "My Batches" },
  { href: "/portal/schedule", label: "Class Schedule" },
  { href: "/portal/attendance", label: "Attendance" },
  { href: "/portal/progress", label: "Progress" },
  { href: "/portal/assignments", label: "Assignments" },
  { href: "/portal/certificates", label: "Certificates" },
  { href: "/portal/achievements", label: "Achievements" },
];
