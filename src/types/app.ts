// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
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

export interface Mitglieder {
  record_id: string;
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
  createdat: string;
  updatedat: string | null;
  fields: {
    mitglied?: string; // applookup -> URL zu 'Mitglieder' Record
    beitragsjahr?: number;
    beitragshoehe?: number;
    zahlungsart?: LookupValue;
    zahlungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    zahlungsstatus?: LookupValue;
    bemerkungen_zahlung?: string;
  };
}

export interface Veranstaltungen {
  record_id: string;
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

export interface Veranstaltungsteilnahmen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    mitglied?: string; // applookup -> URL zu 'Mitglieder' Record
    veranstaltung?: string; // applookup -> URL zu 'Veranstaltungen' Record
    anmeldedatum?: string; // Format: YYYY-MM-DD oder ISO String
    anwesenheit?: boolean;
    bemerkungen_teilnahme?: string;
  };
}

export const APP_IDS = {
  MITGLIEDER: '6a2c051add06b14dff7ae846',
  BEITRAEGE_ZAHLUNGEN: '6a2c05202232d348547938ed',
  VERANSTALTUNGEN: '6a2c05219a64afeec0949857',
  VERANSTALTUNGSTEILNAHMEN: '6a2c05211de15074379308bd',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'mitglieder': {
    mitgliedsstatus: [{ key: "passiv", label: "Passiv" }, { key: "ehrenmitglied", label: "Ehrenmitglied" }, { key: "ausgetreten", label: "Ausgetreten" }, { key: "aktiv", label: "Aktiv" }],
  },
  'beitraege_&_zahlungen': {
    zahlungsart: [{ key: "ueberweisung", label: "Überweisung" }, { key: "lastschrift", label: "Lastschrift" }, { key: "bar", label: "Barzahlung" }],
    zahlungsstatus: [{ key: "offen", label: "Offen" }, { key: "bezahlt", label: "Bezahlt" }, { key: "gemahnt", label: "Gemahnt" }, { key: "storniert", label: "Storniert" }],
  },
  'veranstaltungen': {
    veranstaltungsart: [{ key: "vortrag", label: "Vortrag" }, { key: "workshop", label: "Workshop" }, { key: "mitgliederversammlung", label: "Mitgliederversammlung" }, { key: "networking", label: "Networking" }, { key: "sonstiges", label: "Sonstiges" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
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
  'beitraege_&_zahlungen': {
    'mitglied': 'applookup/select',
    'beitragsjahr': 'number',
    'beitragshoehe': 'number',
    'zahlungsart': 'lookup/select',
    'zahlungsdatum': 'date/date',
    'zahlungsstatus': 'lookup/select',
    'bemerkungen_zahlung': 'string/textarea',
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
  'veranstaltungsteilnahmen': {
    'mitglied': 'applookup/select',
    'veranstaltung': 'applookup/select',
    'anmeldedatum': 'date/date',
    'anwesenheit': 'bool',
    'bemerkungen_teilnahme': 'string/textarea',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateMitglieder = StripLookup<Mitglieder['fields']>;
export type CreateBeitraegeZahlungen = StripLookup<BeitraegeZahlungen['fields']>;
export type CreateVeranstaltungen = StripLookup<Veranstaltungen['fields']>;
export type CreateVeranstaltungsteilnahmen = StripLookup<Veranstaltungsteilnahmen['fields']>;