"use client";

import { useState, useTransition } from "react";
import { FormField } from "@/components/forms/FormField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import {
  tournamentRegistrationSchema,
  genderOptions,
  chessLevels,
} from "@/lib/validation/tournamentRegistration";
import { calculateAge } from "@/lib/validation/trial";
import { submitTournamentRegistration } from "@/lib/actions/tournamentRegistration";
import type { Tournament } from "@/content/tournaments";

type FormState = Record<string, string | boolean>;

function buildInitialState(initialCategoryId?: string): FormState {
  return {
    playerFullName: "",
    dateOfBirth: "",
    gender: "",
    fideId: "",
    fideRating: "",
    chessAssociationId: "",
    country: "",
    state: "",
    city: "",
    categoryId: initialCategoryId ?? "",
    email: "",
    phone: "",
    whatsapp: "",
    parentName: "",
    parentRelationship: "",
    parentEmail: "",
    parentPhone: "",
    currentChessLevel: "",
    schoolOrAcademy: "",
    club: "",
    rulesConsent: false,
    privacyConsent: false,
    mediaConsent: false,
    marketingConsent: false,
    // Honeypot — see the hidden field below. Must stay empty for a real submission.
    website: "",
  };
}

interface TournamentRegisterFormProps {
  tournament: Tournament;
  /**
   * A pre-validated category id (already checked against this
   * tournament's real categories by the page — never a raw, unchecked
   * query parameter). Undefined means no category was preselected.
   */
  initialCategoryId?: string;
}

type SubmitPhase = "idle" | "success" | "error";

/**
 * Tournament registration form — real Supabase-backed submission
 * (Phase 7). Client-side validation (category membership + Zod schema,
 * including the minor/guardian rule) is UX only; the Server Action
 * (`submitTournamentRegistration`) re-validates everything server-side
 * and resolves tournament/category server-side from slug + category
 * key — never from a client-supplied database id. On success this shows
 * the "received for review" message the form actually earned — never a
 * fake "Registration Successful" or a reserved-seat claim, since no
 * payment/confirmation workflow exists yet.
 */
export function TournamentRegisterForm({ tournament, initialCategoryId }: TournamentRegisterFormProps) {
  const categories = tournament.categories ?? [];
  const [values, setValues] = useState<FormState>(() => buildInitialState(initialCategoryId));
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

    // Category is only ever validated against this tournament's real,
    // configured categories — an arbitrary/unrecognized categoryId can't
    // pass this check even if someone tampers with the submitted value.
    // The Server Action re-runs this same check server-side.
    const categoryIsValid = categories.some((category) => category.id === values.categoryId);
    if (!categoryIsValid) {
      setErrors({ categoryId: "Select a valid tournament category." });
      setPhase("idle");
      return;
    }

    const result = tournamentRegistrationSchema.safeParse(values);

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
      const response = await submitTournamentRegistration(tournament, {
        playerFullName: values.playerFullName as string,
        dateOfBirth: values.dateOfBirth as string,
        gender: values.gender as string,
        fideId: values.fideId as string,
        fideRating: values.fideRating as string,
        chessAssociationId: values.chessAssociationId as string,
        country: values.country as string,
        state: values.state as string,
        city: values.city as string,
        categoryId: values.categoryId as string,
        email: values.email as string,
        phone: values.phone as string,
        whatsapp: values.whatsapp as string,
        parentName: values.parentName as string,
        parentRelationship: values.parentRelationship as string,
        parentEmail: values.parentEmail as string,
        parentPhone: values.parentPhone as string,
        currentChessLevel: values.currentChessLevel as string,
        schoolOrAcademy: values.schoolOrAcademy as string,
        club: values.club as string,
        rulesConsent: values.rulesConsent as boolean,
        privacyConsent: values.privacyConsent as boolean,
        mediaConsent: values.mediaConsent as boolean,
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
        <p className="text-h4 text-foreground">Registration received.</p>
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
              setValues(buildInitialState(initialCategoryId));
            }}
          >
            Register Another Player
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-12">
      <fieldset>
        <legend className="text-h4 text-foreground mb-6">Player Information</legend>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="Player Full Name"
            name="playerFullName"
            autoComplete="name"
            value={values.playerFullName as string}
            onChange={(e) => update("playerFullName", e.target.value)}
            error={errors.playerFullName}
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
            label="Gender (optional)"
            name="gender"
            value={values.gender as string}
            onChange={(e) => update("gender", e.target.value)}
            error={errors.gender}
          >
            <option value="">Prefer not to say</option>
            {genderOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Tournament Category"
            name="categoryId"
            value={values.categoryId as string}
            onChange={(e) => update("categoryId", e.target.value)}
            error={errors.categoryId}
          >
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
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
            label="Chess Association ID (optional)"
            name="chessAssociationId"
            value={values.chessAssociationId as string}
            onChange={(e) => update("chessAssociationId", e.target.value)}
            error={errors.chessAssociationId}
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
        <legend className="text-h4 text-foreground mb-6">Contact Information</legend>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            value={values.email as string}
            onChange={(e) => update("email", e.target.value)}
            error={errors.email}
          />
          <FormField
            label="Phone"
            type="tel"
            name="phone"
            autoComplete="tel"
            value={values.phone as string}
            onChange={(e) => update("phone", e.target.value)}
            error={errors.phone}
          />
          <FormField
            label="WhatsApp (optional)"
            type="tel"
            name="whatsapp"
            value={values.whatsapp as string}
            onChange={(e) => update("whatsapp", e.target.value)}
            error={errors.whatsapp}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-h4 text-foreground mb-2">Parent / Guardian Information</legend>
        <p className="text-body-sm text-muted-foreground mb-6">
          {isLikelyMinor
            ? "Required for players under 18."
            : "Optional — provide if you'd like a parent/guardian included on this registration."}
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
            label="Relationship to Player"
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

      <fieldset>
        <legend className="text-h4 text-foreground mb-6">Chess Information (Optional)</legend>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            label="Current Chess Level"
            name="currentChessLevel"
            value={values.currentChessLevel as string}
            onChange={(e) => update("currentChessLevel", e.target.value)}
            error={errors.currentChessLevel}
          >
            <option value="">Not specified</option>
            {chessLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </SelectField>
          <FormField
            label="School / Academy"
            name="schoolOrAcademy"
            value={values.schoolOrAcademy as string}
            onChange={(e) => update("schoolOrAcademy", e.target.value)}
            error={errors.schoolOrAcademy}
          />
          <FormField
            label="Club"
            name="club"
            value={values.club as string}
            onChange={(e) => update("club", e.target.value)}
            error={errors.club}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-h4 text-foreground mb-2">Consent</legend>

        <label className="flex items-start gap-3 text-body-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={values.rulesConsent as boolean}
            onChange={(e) => update("rulesConsent", e.target.checked)}
            aria-describedby={errors.rulesConsent ? "rules-consent-error" : undefined}
            className="mt-0.5 h-4 w-4 shrink-0 accent-(--primary)"
          />
          I acknowledge and agree to follow the tournament rules.
        </label>
        {errors.rulesConsent ? (
          <p id="rules-consent-error" role="alert" className="text-body-sm text-danger">
            {errors.rulesConsent}
          </p>
        ) : null}

        <label className="flex items-start gap-3 text-body-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={values.privacyConsent as boolean}
            onChange={(e) => update("privacyConsent", e.target.checked)}
            aria-describedby={errors.privacyConsent ? "privacy-consent-error" : undefined}
            className="mt-0.5 h-4 w-4 shrink-0 accent-(--primary)"
          />
          I acknowledge the Privacy Policy and consent to Phoenix Chess Academy contacting me about this registration.
        </label>
        {errors.privacyConsent ? (
          <p id="privacy-consent-error" role="alert" className="text-body-sm text-danger">
            {errors.privacyConsent}
          </p>
        ) : null}

        <label className="flex items-start gap-3 text-body-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={values.mediaConsent as boolean}
            onChange={(e) => update("mediaConsent", e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-(--primary)"
          />
          (Optional) I consent to photos/video from this tournament being used by Phoenix Chess Academy for promotional purposes.
        </label>

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
        <label htmlFor="tournament-register-website-field">Leave this field blank</label>
        <input
          type="text"
          id="tournament-register-website-field"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={values.website as string}
          onChange={(e) => update("website", e.target.value)}
        />
      </div>

      <Button type="submit" variant="primary" size="lg" disabled={isPending}>
        {isPending ? "Submitting..." : "Submit Registration"}
      </Button>
    </form>
  );
}
