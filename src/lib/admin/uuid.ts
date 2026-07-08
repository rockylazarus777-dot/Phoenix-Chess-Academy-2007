const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every admin detail route ("/admin/students/[id]" and similar) validates the URL param is a real UUID before querying — an invalid ID renders 404, never a raw DB error. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
