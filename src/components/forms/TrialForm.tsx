"use client";

import { useState, useTransition } from "react";
import { FormField } from "@/components/forms/FormField";
import { SelectField } from "@/components/forms/SelectField";
import { TextareaField } from "@/components/forms/TextareaField";
import { Button } from "@/components/ui/Button";
import {
  trialFormSchema,
  chessLevels,
  trainingModes,
  preferredPrograms,
  calculateAge,
} from "@/lib/validation/trial";
import { submitTrialBooking } from "@/lib/actions/trial";

type FormState = Record<string, string | boolean>;

function buildInitialState(initialProgram?: string): FormState {
  return {
    studentFullName: "",
    dateOfBirth: "",
    chessLevel: "",
    fideId: "",
    fideRating: "",
    country: "",
    state: "",
    city: "",
    preferredProgram: initialProgram ?? "",
    trainingMode: "",
    preferredSchedule: "",
    goals: "",
    parentName: "",
    parentEmail: "",
    parentPhone: "",
    parentRelationship: "",
    privacyConsent: false,
    marketingConsent: false,
    // Honeypot — see the hidden field below. Must stay empty for a real submission.
    website: "",
  };
}

type SubmitPhase = "idle" | "success" | "error";

/**
 * Book a Trial form — real Supabase-backed submission (Phase 7).
 * Client-side Zod validation (including the minor/guardian
 * `.superRefine` rule) is UX only; the Server Action
 * (`submitTrialBooking`) re-validates the identical schema server-side.
 * On success this shows the received-for-review message the form
 * actually earned — never a fake booking confirmation or a "trial
 * scheduled" claim, since no scheduling exists yet.
 */
interface TrialFormProps {
  /**
   * A pre-validated preferredProgram display value (already checked
   * against real program data by the page — never a raw, unchecked query
   * parameter). Undefined means no program was preselected.
   */
  initialProgram?: string;
}

export function TrialForm({ initialProgram }: TrialFormProps) {
  const [values, setValues] = useState<FormState>(() => buildInitialState(initialProgram));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const age = calculateAge(values.dateOfBirth as string);
  const isLikelyMinor = age === null || age < 18;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = trialFormSchema.safeParse(values);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setPhase("idle");
      return;
    }

    setErrors({});
    startTransition(async () => {
      const response = await submitTrialBooking({
        studentFullName: values.studentFullName as string,
        dateOfBirth: values.dateOfBirth as string,
        chessLevel: values.chessLevel as string,
        fideId: values.fideId as string,
        fideRating: values.fideRating as string,
        country: values.country as string,
        state: values.state as string,
        city: values.city as string,
        preferredProgram: values.preferredProgram as string,
        trainingMode: values.trainingMode as string,
        preferredSchedule: values.preferredSchedule as string,
        goals: values.goals as string,
        parentName: values.parentName as string,
        parentEmail: values.parentEmail as string,
        parentPhone: values.parentPhone as string,
        parentRelationship: values.parentRelationship as string,
        privacyConsent: values.privacyConsent as boolean,
        marketingConsent: values.marketingConsent as boolean,
        website: values.website as string,
      });
      setPhase(response.success ? "success" : "error");
      setResultMessage(response.message);
    });
  }

  if (phase === "success") {
    return (
      <div className="rounded-2xl border border-primary/40 bg-surface p-6">
        <p className="text-h4 text-foreground">Trial request received.</p>
        <p className="text-body-sm text-muted-foreground mt-3">{resultMessage}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button href="/contact" variant="primary" size="md">
            Contact Phoenix
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setPhase("idle");
              setResultMessage(null);
              setValues(buildInitialState(initialProgram));
            }}
          >
            Submit Another Request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-12">
      <fieldset>
        <legend className="text-h4 text-foreground mb-6">Student Information</legend>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="Student Full Name"
            name="studentFullName"
            autoComplete="name"
            value={values.studentFullName as string}
            onChange={(e) => update("studentFullName", e.target.value)}
            error={errors.studentFullName}
          />
          <FormField
            label="Date of Birth"
            type="date"
            name="dateOfBirth"
            value={values.dateOfBirth as string}
            onChange={(e) => update("dateOfBirth", e.target.value)}
            error={errors.dateOfBirth}
          />
          <SelectField
            label="Current Chess Level"
            name="chessLevel"
            value={values.chessLevel as string}
            onChange={(e) => update("chessLevel", e.target.value)}
            error={errors.chessLevel}
          >
            <option value="" disabled>
              Select current level
            </option>
            {chessLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </SelectField>
          <FormField
            label="FIDE ID (optional)"
            name="fideId"
            value={values.fideId as string}
            onChange={(e) => update("fideId", e.target.value)}
            error={errors.fideId}
          />
          <FormField
            label="FIDE Rating (optional)"
            name="fideRating"
            inputMode="numeric"
            value={values.fideRating as string}
            onChange={(e) => update("fideRating", e.target.value)}
            error={errors.fideRating}
          />
          <FormField
            label="Country"
            name="country"
            autoComplete="country-name"
            value={values.country as string}
            onChange={(e) => update("country", e.target.value)}
            error={errors.country}
          />
          <FormField
            label="State / Province"
            name="state"
            autoComplete="address-level1"
            value={values.state as string}
            onChange={(e) => update("state", e.target.value)}
            error={errors.state}
          />
          <FormField
            label="City"
            name="city"
            autoComplete="address-level2"
            value={values.city as string}
            onChange={(e) => update("city", e.target.value)}
            error={errors.city}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-h4 text-foreground mb-6">Training Preference</legend>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            label="Preferred Program"
            name="preferredProgram"
            value={values.preferredProgram as string}
            onChange={(e) => update("preferredProgram", e.target.value)}
            error={errors.preferredProgram}
          >
            <option value="" disabled>
              Select a program
            </option>
            {preferredPrograms.map((program) => (
              <option key={program} value={program}>
                {program}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Training Mode"
            name="trainingMode"
            value={values.trainingMode as string}
            onChange={(e) => update("trainingMode", e.target.value)}
            error={errors.trainingMode}
          >
            <option value="" disabled>
              Select a training mode
            </option>
            {trainingModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </SelectField>
          <FormField
            label="Preferred Schedule (optional)"
            name="preferredSchedule"
            hint="e.g. weekday evenings, weekend mornings"
            value={values.preferredSchedule as string}
            onChange={(e) => update("preferredSchedule", e.target.value)}
            error={errors.preferredSchedule}
            containerClassName="sm:col-span-2"
          />
          <TextareaField
            label="Goals / Notes (optional)"
            name="goals"
            value={values.goals as string}
            onChange={(e) => update("goals", e.target.value)}
            error={errors.goals}
            containerClassName="sm:col-span-2"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-h4 text-foreground mb-2">Parent / Guardian Information</legend>
        <p className="text-body-sm text-muted-foreground mb-6">
          {isLikelyMinor
            ? "Required for students under 18."
            : "Optional — provide if you'd like a parent/guardian included on this enquiry."}
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="Parent / Guardian Name"
            name="parentName"
            autoComplete="name"
            value={values.parentName as string}
            onChange={(e) => update("parentName", e.target.value)}
            error={errors.parentName}
          />
          <FormField
            label="Relationship to Student"
            name="parentRelationship"
            value={values.parentRelationship as string}
            onChange={(e) => update("parentRelationship", e.target.value)}
            error={errors.parentRelationship}
          />
          <FormField
            label="Parent / Guardian Email"
            type="email"
            name="parentEmail"
            autoComplete="email"
            value={values.parentEmail as string}
            onChange={(e) => update("parentEmail", e.target.value)}
            error={errors.parentEmail}
          />
          <FormField
            label="Parent / Guardian Phone"
            type="tel"
            name="parentPhone"
            autoComplete="tel"
            value={values.parentPhone as string}
            onChange={(e) => update("parentPhone", e.target.value)}
            error={errors.parentPhone}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-h4 text-foreground mb-2">Consent</legend>
        <label className="flex items-start gap-3 text-body-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={values.privacyConsent as boolean}
            onChange={(e) => update("privacyConsent", e.target.checked)}
            aria-describedby={errors.privacyConsent ? "privacy-consent-error" : undefined}
            className="mt-0.5 h-4 w-4 shrink-0 accent-(--primary)"
          />
          I acknowledge the Privacy Policy and consent to Phoenix Chess Academy contacting me about this trial request.
        </label>
        {errors.privacyConsent ? (
          <p id="privacy-consent-error" role="alert" className="text-body-sm text-danger">
            {errors.privacyConsent}
          </p>
        ) : null}

        <label className="flex items-start gap-3 text-body-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={values.marketingConsent as boolean}
            onChange={(e) => update("marketingConsent", e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-(--primary)"
          />
          (Optional) I&apos;d like to receive updates about programs, tournaments, and academy news.
        </label>
      </fieldset>

      {phase === "error" && resultMessage ? (
        <div role="alert">
          <p className="text-body-sm text-danger">{resultMessage}</p>
        </div>
      ) : null}

      {/* Honeypot: visually hidden, never given a human-recognizable label. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="trial-website-field">Leave this field blank</label>
        <input
          type="text"
          id="trial-website-field"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={values.website as string}
          onChange={(e) => update("website", e.target.value)}
        />
      </div>

      <Button type="submit" variant="primary" size="lg" disabled={isPending}>
        {isPending ? "Submitting..." : "Submit Trial Request"}
      </Button>
    </form>
  );
}
