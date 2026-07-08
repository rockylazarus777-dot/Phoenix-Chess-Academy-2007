import { z } from "zod";

/**
 * Auth schemas. Client-side validation here is UX only — every Server
 * Action in src/lib/actions/auth.ts re-validates with these same
 * schemas, since the client's own pass can always be bypassed.
 */

/**
 * Login: only checks an email shape and that a password was typed at
 * all. Deliberately no password complexity regex — the password already
 * exists and was set under whatever rule applied when it was created;
 * rejecting a valid existing password because it doesn't match a new
 * frontend regex would lock someone out of a real account for no
 * security benefit. Real authentication happens via Supabase
 * `signInWithPassword`, not this schema.
 */
export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/**
 * Reset password: this is the one place a real requirement is
 * enforced (minimum length), since this sets a brand-new credential
 * rather than checking an existing one. Kept to a reasonable baseline —
 * no symbol/uppercase/emoji rules.
 */
export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
