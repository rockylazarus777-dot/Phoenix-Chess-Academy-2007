import { z } from "zod";

/**
 * Bulk student CSV import — schema, limits, and header allow-list.
 * See docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Bulk Import Architecture".
 */

export const MAX_IMPORT_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_IMPORT_ROWS = 500; // per import batch — a 5,000-student

// rollout is done as ~10 controlled imports, not one giant file.
export const IMPORT_INSERT_CHUNK_SIZE = 50;

/**
 * Exact, ordered allow-list of accepted CSV headers. Any header not in
 * this list is rejected outright (IMPORT_VALIDATION_FAILED) rather than
 * silently ignored — an unrecognized column is more likely a mistake
 * (wrong template, wrong export) than an intentional extra field.
 * `student_code` is accepted ONLY to detect that a row already exists
 * in Phoenix's system (see duplicate-matching hierarchy below) — it is
 * NEVER used to set the code of a newly created record; new codes are
 * always DB-generated via generate_student_code().
 */
export const IMPORT_ALLOWED_HEADERS = [
  "full_name",
  "date_of_birth",
  "gender",
  "email",
  "phone",
  "whatsapp",
  "country",
  "state",
  "city",
  "address",
  "fide_id",
  "fide_rating",
  "chess_association_id",
  "current_level",
  "joined_on",
  "notes",
  "student_code",
] as const;

export const IMPORT_REQUIRED_HEADERS = ["full_name", "date_of_birth", "country"] as const;

export const importStudentRowSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required.").max(200),
  date_of_birth: z.string().trim().min(1, "Date of birth is required."),
  gender: z.string().trim().max(50).optional().or(z.literal("")),
  email: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  country: z.string().trim().min(1, "Country is required.").max(100),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  fide_id: z.string().trim().max(50).optional().or(z.literal("")),
  fide_rating: z.string().trim().max(6).optional().or(z.literal("")),
  chess_association_id: z.string().trim().max(50).optional().or(z.literal("")),
  current_level: z.string().trim().max(100).optional().or(z.literal("")),
  joined_on: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  student_code: z.string().trim().max(30).optional().or(z.literal("")),
});

export type ImportStudentRow = z.infer<typeof importStudentRowSchema>;

export interface ImportRowResult {
  rowNumber: number; // 1-based, matches spreadsheet row (header = row 1)
  status: "VALID" | "INVALID" | "DUPLICATE";
  data?: ImportStudentRow;
  errors?: string[];
  duplicateReason?: string;
  duplicateOfStudentId?: string;
}

export interface ImportPreview {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  rows: ImportRowResult[];
}
