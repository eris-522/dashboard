export interface EventTypeMeta {
  label: string;
  color: string;
}

export const CORE_EVENT_TYPES: EventTypeMeta[] = [
  { label: "Wedding", color: "#a68a56" },
  { label: "Debut", color: "#9333ea" },
  { label: "Birthday", color: "#d97706" },
  { label: "Corporate", color: "#2563eb" },
  { label: "All Occasions / Social", color: "#6b8e23" },
];

const EXTRA_EVENT_TYPE_COLORS: Record<string, string> = {
  Anniversary: "#db2777",
  "Baptism / Christening": "#0891b2",
  Graduation: "#4f46e5",
  "Family Reunion": "#059669",
};

const FALLBACK_COLORS = ["#0d9488", "#e11d48", "#7c3aed", "#ca8a04", "#0284c7"];

const GENERIC_EVENT_VALUES = new Set([
  "",
  "event",
  "events",
  "general",
  "social",
  "other",
  "others",
  "custom",
  "custom package",
  "all occasions",
  "all occasions / social",
]);

function matchCanonicalEventType(raw: string): string | null {
  const lower = raw.trim().toLowerCase();
  if (!lower) return null;

  if (/\b(wedding|bridal|nuptial|matrimony|civil wedding|garden wedding)\b/.test(lower)) {
    return "Wedding";
  }
  if (/\b(debut|18th|cotillion|eighteenth)\b/.test(lower)) {
    return "Debut";
  }
  if (/\b(birthday|bday|b-day|kiddie|1st|7th|50th|60th)\b/.test(lower)) {
    return "Birthday";
  }
  if (
    /\b(corporate|conference|seminar|company|office|summit|gala|year-end|year end|team building|executive|christmas party|business)\b/.test(
      lower
    )
  ) {
    return "Corporate";
  }
  if (/\b(anniversary|silver|golden)\b/.test(lower)) {
    return "Anniversary";
  }
  if (/\b(baptism|christening|dedication|binyag)\b/.test(lower)) {
    return "Baptism / Christening";
  }
  if (/\b(graduation|grad|recognition)\b/.test(lower)) {
    return "Graduation";
  }
  if (/\b(reunion|homecoming)\b/.test(lower)) {
    return "Family Reunion";
  }
  if (/\b(all occasions|social|private gathering|private party|fiesta|shower)\b/.test(lower)) {
    return "All Occasions / Social";
  }

  return null;
}

/**
 * Resolves a booking or package into a clean, consistent celebration category.
 * Prioritizes explicit non-generic `event_type`, then infers from `package_name`
 * (preventing legacy `packages.type = 'Social'` defaults from masking Weddings,
 * Debuts, Birthdays, or Corporate events), and falls back to `All Occasions / Social`.
 */
export function resolveEventType(
  rawEventType?: string | null,
  packageName?: string | null,
  packageType?: string | null
): string {
  const cleanEvent = String(rawEventType || "").trim();
  if (cleanEvent && !GENERIC_EVENT_VALUES.has(cleanEvent.toLowerCase())) {
    const matched = matchCanonicalEventType(cleanEvent);
    if (matched) return matched;
    return cleanEvent;
  }

  const cleanPkgName = String(packageName || "").trim();
  if (cleanPkgName) {
    const matched = matchCanonicalEventType(cleanPkgName);
    if (matched) return matched;
  }

  const cleanPkgType = String(packageType || "").trim();
  if (cleanPkgType && !GENERIC_EVENT_VALUES.has(cleanPkgType.toLowerCase())) {
    const matched = matchCanonicalEventType(cleanPkgType);
    if (matched) return matched;
    return cleanPkgType;
  }

  return "All Occasions / Social";
}

export function getEventTypeColor(eventType: string, fallbackIndex = 0): string {
  const core = CORE_EVENT_TYPES.find((c) => c.label === eventType);
  if (core) return core.color;
  if (EXTRA_EVENT_TYPE_COLORS[eventType]) return EXTRA_EVENT_TYPE_COLORS[eventType];
  return FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length];
}
