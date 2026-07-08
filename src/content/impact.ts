/**
 * Academy impact / international-presence data. No country or location
 * data has been confirmed yet, so this stays an empty, typed, ready-to-fill
 * array rather than a fabricated world map. AcademyImpact.tsx renders a
 * fallback built only from confirmed facts (student count, online program
 * availability) until real location data exists.
 */
export interface AcademyLocation {
  city: string;
  state: string;
  country: string;
}

export const academyLocations: AcademyLocation[] = [];
