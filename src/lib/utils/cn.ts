type ClassValue = string | number | null | undefined | false | ClassValue[];

/**
 * Minimal classnames combiner. Avoids pulling in `clsx`/`tailwind-merge`
 * for a need this small — flattens falsy/nested values into a single
 * space-separated class string.
 */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];

  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }

  return out.join(" ");
}
