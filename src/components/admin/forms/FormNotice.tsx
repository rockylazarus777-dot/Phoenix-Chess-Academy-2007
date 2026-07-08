"use client";

/** Success/error banner shown after a Server Action call resolves — plain text, never raw DB/Auth error strings (those never reach the client in the first place; see src/lib/admin/errors.ts). */
export function FormNotice({ tone, message }: { tone: "success" | "error"; message: string }) {
  return (
    <div
      role="status"
      className={`rounded-md border p-3 text-body-sm ${
        tone === "success" ? "border-success/50 text-success" : "border-danger/50 text-danger"
      }`}
    >
      {message}
    </div>
  );
}
