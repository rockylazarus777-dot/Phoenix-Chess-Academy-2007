import { z } from "zod";

export const trainingModeValues = ["ONLINE", "OFFLINE", "HYBRID"] as const;
export const attendanceStatusValues = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;

/**
 * Coach-submitted new-session form. `batchId` is validated as a UUID
 * here, but knowing a UUID never authorizes anything by itself — the
 * Server Action re-verifies `batchId` against `batch_coaches` via
 * `getAssignedBatch()` AFTER this schema passes, exactly as the spec
 * requires ("Re-authorize the submitted batch through batch_coaches.
 * Then insert."). `coachId`/`createdBy` are never fields on this schema
 * — the server always derives them from `getCurrentCoach()`/`auth.uid()`.
 * See docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Session Creation
 * Validation".
 */
export const createClassSessionSchema = z
  .object({
    batchId: z.string().uuid("Select a batch."),
    sessionDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid session date."),
    startTime: z.string().trim().min(1, "Start time is required."),
    endTime: z.string().trim().min(1, "End time is required."),
    timezone: z.string().trim().min(1, "Timezone is required.").max(64),
    trainingMode: z.enum(trainingModeValues).optional().or(z.literal("")),
    locationId: z.string().uuid().optional().or(z.literal("")),
    topic: z.string().trim().max(200).optional().or(z.literal("")),
    scheduleId: z.string().uuid().optional().or(z.literal("")),
  })
  .refine((values) => values.endTime > values.startTime, {
    message: "End time must be after the start time.",
    path: ["endTime"],
  });

export type CreateClassSessionValues = z.infer<typeof createClassSessionSchema>;

/**
 * One entry in a bulk attendance submission. `studentId` alone never
 * authorizes anything — the `mark_session_attendance()` RPC re-verifies
 * every submitted student against the session-date-eligible roster
 * server-side and rejects the ENTIRE payload if even one entry is
 * outside it (see "Attendance Upsert Decision" / "Atomic Rejection
 * Behaviour" in the architecture doc). This schema only validates shape
 * before the payload is sent to that RPC.
 */
export const attendanceEntrySchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(attendanceStatusValues),
  notes: z.string().trim().max(500, "Notes must be 500 characters or fewer.").optional().or(z.literal("")),
});

export type AttendanceEntryValues = z.infer<typeof attendanceEntrySchema>;

/** Recommended maximum entries per bulk attendance submission — mirrors the same limit enforced inside mark_session_attendance(). */
export const MAX_ATTENDANCE_ENTRIES = 500;

export const markAttendanceSchema = z
  .object({
    sessionId: z.string().uuid(),
    entries: z.array(attendanceEntrySchema).min(1, "Mark at least one student.").max(MAX_ATTENDANCE_ENTRIES),
  })
  .refine((values) => new Set(values.entries.map((entry) => entry.studentId)).size === values.entries.length, {
    message: "Duplicate student entries are not allowed.",
    path: ["entries"],
  });

export type MarkAttendanceValues = z.infer<typeof markAttendanceSchema>;

export const sessionStatusTransitionValues = ["COMPLETED", "CANCELLED"] as const;

export const transitionSessionStatusSchema = z.object({
  sessionId: z.string().uuid(),
  targetStatus: z.enum(sessionStatusTransitionValues),
});

export type TransitionSessionStatusValues = z.infer<typeof transitionSessionStatusSchema>;
