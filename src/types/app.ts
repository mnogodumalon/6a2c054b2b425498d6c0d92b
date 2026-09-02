import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
/** A raw record URL (applookup reference). NEVER render this directly
 *  in JSX — it is a URL, not a display value. Show the enriched `*Name`
 *  field or resolve it via the entity map instead. Assignable to/from
 *  string everywhere; the `& {}` keeps the alias NAME visible in tsc
 *  error messages (a plain primitive alias gets normalized away). */
export type RecordUrl = string & {};
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Veranstaltungsteilnahmen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    mitglied?: RecordUrl; // applookup -> URL zu 'Mitglieder' Record
    veranstaltung?: RecordUrl; // applookup -> URL zu 'Veranstaltungen' Record
    anmeldedatum?: string; // Format: YYYY-MM-DD oder ISO String
    anwesenheit?: boolean;
    bemerkungen_teilnahme?: string;
  };
}

export interface Veranstaltungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    titel?: string;
    beschreibung?: string;
    datum_uhrzeit?: string; // Format: YYYY-MM-DD oder ISO String
    anmeldeschluss?: string; // Format: YYYY-MM-DD oder ISO String
    veranstaltungsart?: LookupValue;
    veranstaltungsort?: string;
    max_teilnehmer?: number;
    verantwortlicher?: string;
    bemerkungen_veranstaltung?: string;
  };
}

export interface Mitglieder {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    geburtsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    email?: string;
    telefon?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    mitgliedsnummer?: string;
    eintrittsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    mitgliedsstatus?: LookupValue;
    iban?: string;
    bemerkungen?: string;
    vorname?: string;
    nachname?: string;
  };
}

export interface BeitraegeZahlungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    mitglied?: RecordUrl; // applookup -> URL zu 'Mitglieder' Record
    beitragsjahr?: number;
    beitragshoehe?: number;
    zahlungsart?: LookupValue;
    zahlungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    zahlungsstatus?: LookupValue;
    bemerkungen_zahlung?: string;
  };
}

export const APP_IDS = {
  VERANSTALTUNGSTEILNAHMEN: '6a2c05211de15074379308bd',
  VERANSTALTUNGEN: '6a2c05219a64afeec0949857',
  MITGLIEDER: '6a2c051add06b14dff7ae846',
  BEITRAEGE_ZAHLUNGEN: '6a2c05202232d348547938ed',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'veranstaltungen': {
    veranstaltungsart: [{ key: "vortrag", get label() { return lookupLabel('veranstaltungen', 'veranstaltungsart', "vortrag") ?? "Vortrag"; } }, { key: "workshop", get label() { return lookupLabel('veranstaltungen', 'veranstaltungsart', "workshop") ?? "Workshop"; } }, { key: "mitgliederversammlung", get label() { return lookupLabel('veranstaltungen', 'veranstaltungsart', "mitgliederversammlung") ?? "Mitgliederversammlung"; } }, { key: "networking", get label() { return lookupLabel('veranstaltungen', 'veranstaltungsart', "networking") ?? "Networking"; } }, { key: "sonstiges", get label() { return lookupLabel('veranstaltungen', 'veranstaltungsart', "sonstiges") ?? "Sonstiges"; } }],
  },
  'mitglieder': {
    mitgliedsstatus: [{ key: "passiv", get label() { return lookupLabel('mitglieder', 'mitgliedsstatus', "passiv") ?? "Passiv"; } }, { key: "ehrenmitglied", get label() { return lookupLabel('mitglieder', 'mitgliedsstatus', "ehrenmitglied") ?? "Ehrenmitglied"; } }, { key: "ausgetreten", get label() { return lookupLabel('mitglieder', 'mitgliedsstatus', "ausgetreten") ?? "Ausgetreten"; } }, { key: "aktiv", get label() { return lookupLabel('mitglieder', 'mitgliedsstatus', "aktiv") ?? "Aktiv"; } }],
  },
  'beitraege_zahlungen': {
    zahlungsart: [{ key: "ueberweisung", get label() { return lookupLabel('beitraege_zahlungen', 'zahlungsart', "ueberweisung") ?? "Überweisung"; } }, { key: "lastschrift", get label() { return lookupLabel('beitraege_zahlungen', 'zahlungsart', "lastschrift") ?? "Lastschrift"; } }, { key: "bar", get label() { return lookupLabel('beitraege_zahlungen', 'zahlungsart', "bar") ?? "Barzahlung"; } }],
    zahlungsstatus: [{ key: "offen", get label() { return lookupLabel('beitraege_zahlungen', 'zahlungsstatus', "offen") ?? "Offen"; } }, { key: "bezahlt", get label() { return lookupLabel('beitraege_zahlungen', 'zahlungsstatus', "bezahlt") ?? "Bezahlt"; } }, { key: "gemahnt", get label() { return lookupLabel('beitraege_zahlungen', 'zahlungsstatus', "gemahnt") ?? "Gemahnt"; } }, { key: "storniert", get label() { return lookupLabel('beitraege_zahlungen', 'zahlungsstatus', "storniert") ?? "Storniert"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'veranstaltungsteilnahmen': {
    'mitglied': 'applookup/select',
    'veranstaltung': 'applookup/select',
    'anmeldedatum': 'date/date',
    'anwesenheit': 'bool',
    'bemerkungen_teilnahme': 'string/textarea',
  },
  'veranstaltungen': {
    'titel': 'string/text',
    'beschreibung': 'string/textarea',
    'datum_uhrzeit': 'date/datetimeminute',
    'anmeldeschluss': 'date/date',
    'veranstaltungsart': 'lookup/select',
    'veranstaltungsort': 'string/text',
    'max_teilnehmer': 'number',
    'verantwortlicher': 'string/text',
    'bemerkungen_veranstaltung': 'string/textarea',
  },
  'mitglieder': {
    'geburtsdatum': 'date/date',
    'email': 'string/email',
    'telefon': 'string/tel',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'mitgliedsnummer': 'string/text',
    'eintrittsdatum': 'date/date',
    'mitgliedsstatus': 'lookup/select',
    'iban': 'string/text',
    'bemerkungen': 'string/textarea',
    'vorname': 'string/text',
    'nachname': 'string/text',
  },
  'beitraege_zahlungen': {
    'mitglied': 'applookup/select',
    'beitragsjahr': 'number',
    'beitragshoehe': 'number',
    'zahlungsart': 'lookup/select',
    'zahlungsdatum': 'date/date',
    'zahlungsstatus': 'lookup/select',
    'bemerkungen_zahlung': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

// Aliases for the pre-0.0.279 app keys (see 4c).
LOOKUP_OPTIONS['beitraege_&_zahlungen'] = LOOKUP_OPTIONS['beitraege_zahlungen'];
FIELD_TYPES['beitraege_&_zahlungen'] = FIELD_TYPES['beitraege_zahlungen'];

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateVeranstaltungsteilnahmen = StripLookup<Veranstaltungsteilnahmen['fields']>;
export type CreateVeranstaltungen = StripLookup<Veranstaltungen['fields']>;
export type CreateMitglieder = StripLookup<Mitglieder['fields']>;
export type CreateBeitraegeZahlungen = StripLookup<BeitraegeZahlungen['fields']>;