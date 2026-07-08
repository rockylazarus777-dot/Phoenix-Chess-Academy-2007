"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAchievement, updateAchievement } from "@/lib/actions/admin/achievements";
import { searchStudentsForAchievementAction, listProgramsForSelectAction, listTournamentsForSelectAction } from "@/lib/actions/admin/search";
import { achievementTypeValues } from "@/lib/validation/achievements";
import { achievementTypeLabel } from "@/components/certificates/labels";
import { FormField, inputClasses, selectClasses, textareaClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";
import type { AdminStudentSearchResultRow, ProgramRow, TournamentOption } from "@/lib/supabase/types";

type AchievementType = (typeof achievementTypeValues)[number];

const PLACEMENT_TYPES: AchievementType[] = ["TOURNAMENT_WINNER", "TOURNAMENT_RUNNER_UP", "TOURNAMENT_PLACEMENT"];

interface AchievementFormProps {
  mode: "create" | "edit";
  achievementId?: string;
  student?: { id: string; fullName: string; studentCode: string };
  initialValues?: {
    achievementType: AchievementType;
    title: string;
    description: string;
    achievementDate: string;
    programId: string;
    tournamentId: string;
    placement: string;
    externalOrganization: string;
  };
}

const CONTEXT_HINT: Record<AchievementType, string> = {
  TOURNAMENT_WINNER: "Requires a tournament and placement of 1.",
  TOURNAMENT_RUNNER_UP: "Requires a tournament and placement of 2.",
  TOURNAMENT_PLACEMENT: "Requires a tournament and a placement of 1 or greater.",
  CHESS_MILESTONE: "No tournament or placement required.",
  ACADEMY_RECOGNITION: "No tournament or placement required.",
  EXTERNAL_CHESS_ACHIEVEMENT: "Optionally name the external organization. Phoenix Chess Academy is never shown as the organizer of this event.",
};

/**
 * Shared create/edit achievement form. Create mode resolves the student
 * via the narrow admin student search; edit mode shows the student as a
 * fixed, read-only label — `studentId` can never change on an existing
 * record. Placement is only enabled for the three placement achievement
 * types. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin New
 * Achievement" and "Achievement Placement Validation".
 */
export function AchievementForm({ mode, achievementId, student, initialValues }: AchievementFormProps) {
  const [studentQuery, setStudentQuery] = useState(student ? `${student.fullName} (${student.studentCode})` : "");
  const [studentOptions, setStudentOptions] = useState<AdminStudentSearchResultRow[]>([]);
  const [studentId, setStudentId] = useState(student?.id ?? "");

  const [achievementType, setAchievementType] = useState<AchievementType>(initialValues?.achievementType ?? "CHESS_MILESTONE");
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [achievementDate, setAchievementDate] = useState(initialValues?.achievementDate ?? "");
  const [programId, setProgramId] = useState(initialValues?.programId ?? "");
  const [tournamentId, setTournamentId] = useState(initialValues?.tournamentId ?? "");
  const [placement, setPlacement] = useState(initialValues?.placement ?? "");
  const [externalOrganization, setExternalOrganization] = useState(initialValues?.externalOrganization ?? "");

  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);

  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const isPlacementType = PLACEMENT_TYPES.includes(achievementType);

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
    startTransition(async () => {
      if (value.trim().length < 2) {
        setStudentOptions([]);
        return;
      }
      const result = await searchStudentsForAchievementAction(value);
      setStudentOptions(result.ok ? result.data : []);
    });
  }

  function handleTypeChange(value: AchievementType) {
    setAchievementType(value);
    if (!PLACEMENT_TYPES.includes(value)) {
      setPlacement("");
    } else if (value === "TOURNAMENT_WINNER") {
      setPlacement("1");
    } else if (value === "TOURNAMENT_RUNNER_UP") {
      setPlacement("2");
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "create" && !studentId) {
      setNotice({ tone: "error", message: "Search for and select a student first." });
      return;
    }
    if (!title.trim()) {
      setNotice({ tone: "error", message: "Enter an achievement title." });
      return;
    }

    startTransition(async () => {
      const payload = {
        achievementType,
        title,
        description,
        achievementDate,
        programId,
        tournamentId,
        placement: placement === "" ? ("" as const) : Number(placement),
        externalOrganization,
      };

      const result =
        mode === "create"
          ? await createAchievement({ studentId, ...payload })
          : await updateAchievement({ achievementId: achievementId as string, ...payload });

      if (!result.success) {
        setNotice({ tone: "error", message: result.message ?? "Something went wrong." });
        return;
      }

      if (mode === "create" && result.data) {
        router.push(`/admin/achievements/${result.data.id}`);
      } else {
        setNotice({ tone: "success", message: "Achievement updated." });
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
                    onClick={() => {
                      setStudentId(option.student_id);
                      setStudentQuery(`${option.student_name} (${option.student_code})`);
                      setStudentOptions([]);
                    }}
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

      <FormField label="Achievement type" name="achievementType" required>
        <select
          id="achievementType"
          className={selectClasses}
          value={achievementType}
          onChange={(e) => handleTypeChange(e.target.value as AchievementType)}
          required
        >
          {achievementTypeValues.map((value) => (
            <option key={value} value={value}>
              {achievementTypeLabel(value)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">{CONTEXT_HINT[achievementType]}</p>
      </FormField>

      <FormField label="Title" name="title" required>
        <input id="title" className={inputClasses} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
      </FormField>

      <FormField label="Description (optional)" name="description">
        <textarea id="description" className={textareaClasses} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} />
      </FormField>

      <FormField label="Achievement date (optional)" name="achievementDate">
        <input id="achievementDate" type="date" className={inputClasses} value={achievementDate} onChange={(e) => setAchievementDate(e.target.value)} />
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

      <FormField label={isPlacementType ? "Tournament" : "Tournament (optional)"} name="tournamentId" required={isPlacementType}>
        <select id="tournamentId" className={selectClasses} value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} required={isPlacementType}>
          <option value="">None</option>
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>
              {tournament.name}
            </option>
          ))}
        </select>
      </FormField>

      {isPlacementType ? (
        <FormField label="Placement" name="placement" required>
          <input
            id="placement"
            type="number"
            min={1}
            className={inputClasses}
            value={placement}
            disabled={achievementType === "TOURNAMENT_WINNER" || achievementType === "TOURNAMENT_RUNNER_UP"}
            onChange={(e) => setPlacement(e.target.value)}
            required
          />
        </FormField>
      ) : null}

      {achievementType === "EXTERNAL_CHESS_ACHIEVEMENT" ? (
        <FormField label="External organization (optional)" name="externalOrganization">
          <input
            id="externalOrganization"
            className={inputClasses}
            value={externalOrganization}
            onChange={(e) => setExternalOrganization(e.target.value)}
            maxLength={300}
          />
        </FormField>
      ) : null}

      <div>
        <Button type="submit" isLoading={pending} disabled={pending}>
          {mode === "create" ? "Create Achievement" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
