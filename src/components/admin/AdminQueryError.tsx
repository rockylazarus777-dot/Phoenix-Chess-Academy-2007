/** Honest, differentiated "no data" state — used whenever an AdminQueryResult comes back `ok: false`. Never rendered as an empty table (which would look like "zero records"). */
export function AdminQueryError({ code }: { code: "DATABASE_UNAVAILABLE" | "UNKNOWN" }) {
  return (
    <div className="mt-6 rounded-lg border border-danger/40 bg-surface p-4 text-body-sm text-foreground">
      {code === "DATABASE_UNAVAILABLE"
        ? "The admin database isn't available right now. This is not the same as zero records — please try again shortly."
        : "Something went wrong loading this data. Please try again."}
    </div>
  );
}
