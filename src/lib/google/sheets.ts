import "server-only";
import { JWT } from "google-auth-library";

/**
 * Google Sheets reporting module — server-only.
 *
 * PACKAGE CHOICE: uses `google-auth-library` (the auth primitive
 * underlying `googleapis`) plus a direct `fetch` call to the Sheets API
 * v4 REST endpoint, instead of the full `googleapis` package. `googleapis`
 * bundles a generated client for every single Google API (Sheets, Drive,
 * Gmail, Calendar, ...) — multiple megabytes — when this project only
 * ever calls one Sheets endpoint (`values.append`). `google-auth-library`
 * is the same officially-maintained library `googleapis` itself uses for
 * service-account JWT signing, so this still avoids hand-rolled
 * cryptography for the actually-hard part (minting a signed OAuth2
 * access token from a service-account private key) while keeping the
 * bundle small. See docs/GOOGLE_SHEETS_REPORTING.md, "Package Choice".
 *
 * Google Sheets is reporting/export only — never the primary database.
 * See docs/GOOGLE_SHEETS_REPORTING.md, "Why Outbox Architecture".
 */

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export const WORKSHEET_NAMES = {
  contactEnquiries: "Contact Enquiries",
  trialBookings: "Trial Bookings",
  tournamentRegistrations: "Tournament Registrations",
} as const;

/**
 * The private key from a downloaded service-account JSON file contains
 * literal two-character "\n" escape sequences when stored in a single-
 * line .env value. This converts them to real newlines at runtime — see
 * .env.example for the exact expected format.
 */
function normalizePrivateKey(rawKey: string): string {
  return rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
}

export function isGoogleSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  );
}

let cachedClient: JWT | null = null;

function getAuthClient(): JWT {
  if (cachedClient) return cachedClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error("Google Sheets requested but GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY are not configured.");
  }

  cachedClient = new JWT({
    email,
    key: normalizePrivateKey(rawKey),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return cachedClient;
}

async function getAccessToken(): Promise<string> {
  const client = getAuthClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error("Failed to obtain a Google access token for the Sheets service account.");
  }
  return tokenResponse.token;
}

export type SheetCellValue = string | number | boolean | null;

/**
 * Appends one row to the given worksheet using the Sheets API v4
 * `values.append` endpoint (USER_ENTERED so dates/numbers are
 * interpreted, not just stored as literal text).
 */
export async function appendRowToSheet(worksheetName: string, values: SheetCellValue[]): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured.");
  }

  const accessToken = await getAccessToken();
  const range = encodeURIComponent(`'${worksheetName}'!A1`);
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [values] }),
  });

  if (!response.ok) {
    // Do not include the response body verbatim in thrown errors that
    // might be logged with request context elsewhere — the caller
    // (the sync route) only stores a short, generic failure reason.
    throw new Error(`Google Sheets append failed with status ${response.status}`);
  }
}

// ---------------------------------------------------------------------------
// FIELD MAPPING — explicit column order per worksheet. Every row must
// contain the immutable Supabase record id (first column) so duplicate
// reporting rows can be found/reconciled by matching that id — see
// docs/GOOGLE_SHEETS_REPORTING.md, "Idempotency Strategy". Fields with no
// operational reporting purpose (consent booleans, source, free-text
// notes/goals) are intentionally excluded — see that same doc for the
// full excluded-field list.
// ---------------------------------------------------------------------------

interface OutboxPayload {
  [key: string]: unknown;
}

export function mapContactEnquiryToRow(payload: OutboxPayload): SheetCellValue[] {
  return [
    String(payload.id ?? ""),
    String(payload.created_at ?? ""),
    String(payload.full_name ?? ""),
    String(payload.email ?? ""),
    String(payload.phone ?? ""),
    String(payload.country ?? ""),
    String(payload.enquiry_type ?? ""),
    String(payload.subject ?? ""),
    String(payload.message ?? ""),
    String(payload.status ?? ""),
  ];
}

export function mapTrialBookingToRow(payload: OutboxPayload): SheetCellValue[] {
  return [
    String(payload.id ?? ""),
    String(payload.created_at ?? ""),
    String(payload.student_full_name ?? ""),
    String(payload.date_of_birth ?? ""),
    String(payload.chess_level ?? ""),
    String(payload.fide_id ?? ""),
    payload.fide_rating != null ? Number(payload.fide_rating) : "",
    String(payload.country ?? ""),
    String(payload.state ?? ""),
    String(payload.city ?? ""),
    String(payload.preferred_program ?? ""),
    String(payload.training_mode ?? ""),
    String(payload.preferred_schedule ?? ""),
    String(payload.guardian_name ?? ""),
    String(payload.guardian_email ?? ""),
    String(payload.guardian_phone ?? ""),
    String(payload.status ?? ""),
  ];
}

export function mapTournamentRegistrationToRow(payload: OutboxPayload): SheetCellValue[] {
  return [
    String(payload.id ?? ""),
    String(payload.created_at ?? ""),
    String(payload.tournament_id ?? ""),
    String(payload.tournament_name ?? ""),
    String(payload.category_id ?? ""),
    String(payload.category_name ?? ""),
    String(payload.player_full_name ?? ""),
    String(payload.date_of_birth ?? ""),
    String(payload.fide_id ?? ""),
    payload.fide_rating != null ? Number(payload.fide_rating) : "",
    String(payload.country ?? ""),
    String(payload.state ?? ""),
    String(payload.city ?? ""),
    String(payload.email ?? ""),
    String(payload.phone ?? ""),
    String(payload.whatsapp ?? ""),
    String(payload.guardian_name ?? ""),
    String(payload.guardian_phone ?? ""),
    String(payload.status ?? ""),
  ];
}

/** Resolves the correct worksheet name + row mapper for an outbox event's aggregate_type. */
export function resolveSheetMapping(aggregateType: string): {
  worksheetName: string;
  mapRow: (payload: OutboxPayload) => SheetCellValue[];
} | null {
  switch (aggregateType) {
    case "contact_enquiry":
      return { worksheetName: WORKSHEET_NAMES.contactEnquiries, mapRow: mapContactEnquiryToRow };
    case "trial_booking":
      return { worksheetName: WORKSHEET_NAMES.trialBookings, mapRow: mapTrialBookingToRow };
    case "tournament_registration":
      return { worksheetName: WORKSHEET_NAMES.tournamentRegistrations, mapRow: mapTournamentRegistrationToRow };
    default:
      return null;
  }
}
