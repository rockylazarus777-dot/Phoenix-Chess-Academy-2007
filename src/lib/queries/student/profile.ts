import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  studentQueryOk,
  studentQueryUnavailable,
  studentQueryUnknownError,
  type StudentQueryResult,
} from "@/lib/portal/queryResult";
import type { StudentStatus } from "@/lib/supabase/types";

/**
 * Wider than `StudentPortalIdentity` (which powers the shell/dashboard),
 * but still a deliberately narrow, hand-picked column list — never
 * `select("*")`. Excludes `notes`, `address` (street address is not
 * part of the student-facing profile page; only country/state/city
 * are), `profile_id`, `created_at`/`updated_at`. See
 * docs/STUDENT_PORTAL_ARCHITECTURE.md, "Student PII Exposure Rules".
 */
export interface StudentProfileDetail {
  studentCode: string;
  fullName: string;
  dateOfBirth: string;
  gender: string | null;
  currentLevel: string | null;
  status: StudentStatus;
  joinedOn: string | null;
  fideId: string | null;
  fideRating: number | null;
  chessAssociationId: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  country: string;
  state: string | null;
  city: string | null;
}

export async function getStudentProfile(studentId: string): Promise<StudentQueryResult<StudentProfileDetail>> {
  if (!isSupabaseConfigured()) return studentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("students")
      .select(
        "student_code, full_name, date_of_birth, gender, current_level, status, joined_on, fide_id, fide_rating, chess_association_id, email, phone, whatsapp, country, state, city",
      )
      .eq("id", studentId as never)
      .maybeSingle();

    if (error) return studentQueryUnknownError();
    if (!data) return studentQueryUnknownError();

    const row = data as unknown as {
      student_code: string;
      full_name: string;
      date_of_birth: string;
      gender: string | null;
      current_level: string | null;
      status: StudentStatus;
      joined_on: string | null;
      fide_id: string | null;
      fide_rating: number | null;
      chess_association_id: string | null;
      email: string | null;
      phone: string | null;
      whatsapp: string | null;
      country: string;
      state: string | null;
      city: string | null;
    };

    return studentQueryOk({
      studentCode: row.student_code,
      fullName: row.full_name,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      currentLevel: row.current_level,
      status: row.status,
      joinedOn: row.joined_on,
      fideId: row.fide_id,
      fideRating: row.fide_rating,
      chessAssociationId: row.chess_association_id,
      email: row.email,
      phone: row.phone,
      whatsapp: row.whatsapp,
      country: row.country,
      state: row.state,
      city: row.city,
    });
  } catch {
    return studentQueryUnavailable();
  }
}
