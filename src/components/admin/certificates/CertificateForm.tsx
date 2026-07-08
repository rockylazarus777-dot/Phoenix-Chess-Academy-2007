"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCertificate, updateCertificate } from "@/lib/actions/admin/certificates";
import {
  searchStudentsForCertificateAction,
  listProgramsForSelectAction,
  listTournamentsForSelectAction,
  listAchievementsForStudentAction,
} from "@/lib/actions/admin/search";
import { certificateTypeValues } from "@/lib/validation/certificates";
import { certificateTypeLabel } from "@/components/certificates/labels";
import { FormField, inputClasses, selectClasses, textareaClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";
import type { AdminStudentSearchResultRow, ProgramRow, TournamentOption, AdminAchievementListRow } from "@/lib/supabase/types";

type CertificateType = (typeof certificateTypeValues)[number];

interface CertificateFormProps {
  mode: "create" | "edit";
  certificateId?: string;
  /** Fixed once a certificate exists — the student can never change via this form. */
  student?: { id: string; fullName: string; studentCode: string };
  initialValues?: {
    certificateType: CertificateType;
    title: string;
    description: string;
    programId: string;
    tournamentId: string;
    achievementId: string;
  };
}

const CONTEXT_HINT: Record<CertificateType, string> = {
  PROGRAM_COMPLETION: "Requires a program.",
  PARTICIPATION: "Program and tournament are both optional.",
  TOURNAMENT_PARTICIPATION: "Requires a tournament.",
  TOURNAMENT_ACHIEVEMENT: "Requires a tournament.",
  SPECIAL_RECOGNITION: "Program and tournament are both optional.",
};

/**
 * Shared create/edit certificate form. Create mode resolves the student
 * via the narrow admin student search (never a free-text student_id field,
 * never an academy-wide select); edit mode shows the student as a fixed,
 * read-only label since `studentId` can never change on an existing
 * record (see "Update Certificate RPC" — no delete RPC exists, so
 * choosing the wrong student means creating a new draft rather than
 * fixing this one). See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md,
 * "Admin New Certificate" and "Draft Correction Limitation".
 */
export function CertificateForm({ mode, certificateId, student, initialValues }: CertificateFormProps) {
  const [studentQuery, setStudentQuery] = useState(student ? `${student.fullName} (${student.studentCode})` : "");
  const [studentOptions, setStudentOptions] = useState<AdminStudentSearchResultRow[]>([]);
  const [studentId, setStudentId] = useState(student?.id ?? "");

  const [certificateType, setCertificateType] = useState<CertificateType>(initialValues?.certificateType ?? "PARTICIPATION");
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [programId, setProgramId] = useState(initialValues?.programId ?? "");
  const [tournamentId, setTournamentId] = useState(initialValues?.tournamentId ?? "");
  const [achievementId, setAchievementId] = useState(initialValues?.achievementId ?? "");

  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [achievements, setAchievements] = useState<AdminAchievementListRow[]>([]);

  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    startTransition(async () => {
      const [programResult, tournamentResult] = await Promise.all([listProgramsForSelectAction(), listTournamentsForSelectAction()]);
      if (programResult.ok) setPrograms(programResult.data);
      if (tournamentResult.ok) setTournaments(tournamentResult.data);
    });
  }, []);

  function handleStudentSearch(value: string) {
    setStudentQuery(value);
    setStudentId("");
    setAchievements([]);
    startTransition(async () => {
      if (value.trim().length < 2) {
        setStudentOptions([]);
        return;
      }
      const result = await searchStudentsForCertificateAction(value);
      setStudentOptions(result.ok ? result.data : []);
    });
  }

  /**
   * Fetches the selected student's achievements at the moment of selection
   * (an event handler), not inside a `useEffect` keyed on `studentId` —
   * calling `setState` synchronously inside an effect body triggers
   * cascading renders and is flagged by the `react-hooks/set-state-in-effect`
   * rule. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md,
   * "Certificate-Achievement Relationship".
   */
  function selectStudent(option: AdminStudentSearchResultRow) {
    setStudentId(option.student_id);
    setStudentQuery(`${option.student_name} (${option.student_code})`);
    setStudentOptions([]);
    startTransition(async () => {
      const result = await listAchievementsForStudentAction(option.student_id);
      setAchievements(result.ok ? result.data : []);
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "create" && !studentId) {
      setNotice({ tone: "error", message: "Search for and select a student first." });
      return;
    }
    if (!title.trim()) {
      setNotice({ tone: "error", message: "Enter a certificate title." });
      return;
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createCertificate({
              studentId,
              certificateType,
              title,
              description,
              programId,
              tournamentId,
              achievementId,
            })
          : await updateCertificate({
              certificateId: certificateId as string,
              certificateType,
              title,
              description,
              programId,
              tournamentId,
              achievementId,
            });

      if (!result.success) {
        setNotice({ tone: "error", message: result.message ?? "Something went wrong." });
        return;
      }

      if (mode === "create" && result.data) {
        router.push(`/admin/certificates/${result.data.id}`);
      } else {
        setNotice({ tone: "success", message: "Certificate updated." });
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

      {mode === "create" ? (
        <>
          <FormField label="Student (name or code)" name="studentQuery" required>
            <input
              id="studentQuery"
              className={inputClasses}
              value={studentQuery}
              onChange={(e) => handleStudentSearch(e.target.value)}
              placeholder="Type at least 2 characters"
              required
            />
          </FormField>
          {studentOptions.length > 0 ? (
            <ul className="rounded-md border border-border">
              {studentOptions.map((option) => (
                <li key={option.student_id}>
                  <button
                    type="button"
                    onClick={() => selectStudent(option)}
                    className={`w-full px-3 py-2 text-left text-body-sm hover:bg-surface-elevated ${studentId === option.student_id ? "bg-surface-elevated" : ""}`}
                  >
                    {option.student_name} — {option.student_code}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <FormField label="Student" name="studentFixed">
          <p id="studentFixed" className={`${inputClasses} flex items-center`}>
            {studentQuery}
          </p>
        </FormField>
      )}

      <FormField label="Certificate type" name="certificateType" required>
        <select
          id="certificateType"
          className={selectClasses}
          value={certificateType}
          onChange={(e) => setCertificateType(e.target.value as CertificateType)}
          required
        >
          {certificateTypeValues.map((value) => (
            <option key={value} value={value}>
              {certificateTypeLabel(value)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">{CONTEXT_HINT[certificateType]}</p>
      </FormField>

      <FormField label="Title" name="title" required>
        <input id="title" className={inputClasses} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
      </FormField>

      <FormField label="Description (optional)" name="description">
        <textarea id="description" className={textareaClasses} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} />
      </FormField>

      <FormField label="Program (optional)" name="programId">
        <select id="programId" className={selectClasses} value={programId} onChange={(e) => setProgramId(e.target.value)}>
          <option value="">None</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Tournament (optional)" name="tournamentId">
        <select id="tournamentId" className={selectClasses} value={tournamentId} onChange={(e) => setTournamentId(e.target.value)}>
          <option value="">None</option>
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>
              {tournament.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Linked achievement (optional)" name="achievementId">
        <select id="achievementId" className={selectClasses} value={achievementId} onChange={(e) => setAchievementId(e.target.value)} disabled={!studentId}>
          <option value="">None</option>
          {achievements.map((achievement) => (
            <option key={achievement.achievement_id} value={achievement.achievement_id}>
              {achievement.title}
            </option>
          ))}
        </select>
        {!studentId ? <p className="mt-1 text-xs text-muted-foreground">Select a student first to see their achievements.</p> : null}
      </FormField>

      <div>
        <Button type="submit" isLoading={pending} disabled={pending}>
          {mode === "create" ? "Create Certificate" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
