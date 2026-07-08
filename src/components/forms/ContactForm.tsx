"use client";

import { useState, useTransition } from "react";
import { FormField } from "@/components/forms/FormField";
import { SelectField } from "@/components/forms/SelectField";
import { TextareaField } from "@/components/forms/TextareaField";
import { Button } from "@/components/ui/Button";
import { contactFormSchema, enquiryTypes } from "@/lib/validation/contact";
import { submitContactEnquiry } from "@/lib/actions/contact";

type FormState = Record<string, string | boolean>;

const initialState: FormState = {
  fullName: "",
  email: "",
  phone: "",
  country: "",
  enquiryType: "",
  subject: "",
  message: "",
  consent: false,
  // Honeypot — see the hidden field below. Must stay empty for a real submission.
  website: "",
};

type SubmitPhase = "idle" | "success" | "error";

/**
 * Contact form — real Supabase-backed submission (Phase 7). Client-side
 * Zod validation here is UX only; the Server Action
 * (`submitContactEnquiry`) re-validates the same schema before writing
 * anything. On success this shows the received-for-review message the
 * form actually earned; on failure it shows a safe, specific message —
 * never a raw Supabase error, never a fake success.
 */
export function ContactForm() {
  const [values, setValues] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = contactFormSchema.safeParse(values);

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
      const response = await submitContactEnquiry({
        fullName: values.fullName as string,
        email: values.email as string,
        phone: values.phone as string,
        country: values.country as string,
        enquiryType: values.enquiryType as string,
        subject: values.subject as string,
        message: values.message as string,
        consent: values.consent as boolean,
        website: values.website as string,
      });
      setPhase(response.success ? "success" : "error");
      setResultMessage(response.message);
    });
  }

  if (phase === "success") {
    return (
      <div className="rounded-2xl border border-primary/40 bg-surface p-6">
        <p className="text-h4 text-foreground">Message received.</p>
        <p className="text-body-sm text-muted-foreground mt-3">{resultMessage}</p>
        <div className="mt-5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPhase("idle");
              setResultMessage(null);
              setValues(initialState);
            }}
          >
            Send Another Message
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <FormField
        label="Full Name"
        name="fullName"
        autoComplete="name"
        value={values.fullName as string}
        onChange={(e) => update("fullName", e.target.value)}
        error={errors.fullName}
      />
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
        label="Phone (optional)"
        type="tel"
        name="phone"
        autoComplete="tel"
        value={values.phone as string}
        onChange={(e) => update("phone", e.target.value)}
        error={errors.phone}
      />
      <FormField
        label="Country"
        name="country"
        autoComplete="country-name"
        value={values.country as string}
        onChange={(e) => update("country", e.target.value)}
        error={errors.country}
      />
      <SelectField
        label="Enquiry Type"
        name="enquiryType"
        value={values.enquiryType as string}
        onChange={(e) => update("enquiryType", e.target.value)}
        error={errors.enquiryType}
        containerClassName="sm:col-span-2"
      >
        <option value="" disabled>
          Select an enquiry type
        </option>
        {enquiryTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </SelectField>
      <FormField
        label="Subject"
        name="subject"
        value={values.subject as string}
        onChange={(e) => update("subject", e.target.value)}
        error={errors.subject}
        containerClassName="sm:col-span-2"
      />
      <TextareaField
        label="Message"
        name="message"
        value={values.message as string}
        onChange={(e) => update("message", e.target.value)}
        error={errors.message}
        containerClassName="sm:col-span-2"
      />

      <div className="sm:col-span-2">
        <label className="flex items-start gap-3 text-body-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={values.consent as boolean}
            onChange={(e) => update("consent", e.target.checked)}
            aria-describedby={errors.consent ? "consent-error" : undefined}
            className="mt-0.5 h-4 w-4 shrink-0 accent-(--primary)"
          />
          I acknowledge the Privacy Policy and consent to Phoenix Chess Academy contacting me about this enquiry.
        </label>
        {errors.consent ? (
          <p id="consent-error" role="alert" className="text-body-sm text-danger mt-1.5">
            {errors.consent}
          </p>
        ) : null}
      </div>

      {phase === "error" && resultMessage ? (
        <div className="sm:col-span-2" role="alert">
          <p className="text-body-sm text-danger">{resultMessage}</p>
        </div>
      ) : null}

      {/* Honeypot: visually hidden (not display:none/type=hidden, which
          simple bots often skip specifically), never labeled in a way a
          real user or password manager would recognize. A filled-in
          value means a bot, not a person, submitted this form. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="contact-website-field">Leave this field blank</label>
        <input
          type="text"
          id="contact-website-field"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={values.website as string}
          onChange={(e) => update("website", e.target.value)}
        />
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" size="lg" disabled={isPending}>
          {isPending ? "Sending..." : "Send Message"}
        </Button>
      </div>
    </form>
  );
}
