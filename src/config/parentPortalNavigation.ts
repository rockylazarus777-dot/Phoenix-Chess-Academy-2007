/**
 * The ONLY global Parent Portal nav items. No item links to Progress/
 * Assignments/Certificates/Payments/Messages — those systems don't exist
 * yet, and this project explicitly does not show them as disabled/
 * "Coming Soon" entries either. A specific linked student's Programs/
 * Batches/Schedule/Attendance/Progress/Assignments are NOT global items
 * either — those are contextual, generated per-student by
 * `getParentStudentContextNav()` below. See
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent Global Navigation Items".
 */
export interface ParentNavItem {
  href: string;
  label: string;
}

export const PARENT_NAV_ITEMS: ParentNavItem[] = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/profile", label: "My Profile" },
  { href: "/parent/students", label: "My Students" },
];

/**
 * Contextual navigation shown only while viewing one linked student —
 * generated per-student (not a global config array) since every href is
 * scoped to that student's UUID. Phase 14 added "Attendance" (the real
 * `/parent/students/[studentId]/attendance` route); Phase 15 added
 * "Progress" (the real `/parent/students/[studentId]/progress` route);
 * Phase 16 added "Assignments" (the real
 * `/parent/students/[studentId]/assignments` route); Phase 17 adds
 * "Certificates" and "Achievements" (the real
 * `/parent/students/[studentId]/certificates` and
 * `/parent/students/[studentId]/achievements` routes). Only real routes.
 */
export function getParentStudentContextNav(studentId: string): ParentNavItem[] {
  const base = `/parent/students/${studentId}`;
  return [
    { href: base, label: "Overview" },
    { href: `${base}/programs`, label: "Programs" },
    { href: `${base}/batches`, label: "Batches" },
    { href: `${base}/schedule`, label: "Class Schedule" },
    { href: `${base}/attendance`, label: "Attendance" },
    { href: `${base}/progress`, label: "Progress" },
    { href: `${base}/assignments`, label: "Assignments" },
    { href: `${base}/certificates`, label: "Certificates" },
    { href: `${base}/achievements`, label: "Achievements" },
  ];
}
