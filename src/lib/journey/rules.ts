/**
 * Field rules — GENERATED from the app metadata. Do not edit.
 *
 * The mechanical truth about every field: what kind it is, whether the
 * platform's base view marks it required, which lookup keys exist, where an
 * applookup points, what the label is. `useStepForm` validates against these
 * rules and phrases its messages with the real labels; `toWirePayload` uses
 * them to shape the create payload; `SHAPES` tells a page which input FORM
 * fits the data (a date pair wants a calendar, not two fields) — it is a
 * signal, not a gate.
 */
import { appLabel, fieldLabel, lookupLabel } from '@/i18n';
import { LOOKUP_OPTIONS } from '@/types/app';

export type EntityKey = 'veranstaltungsteilnahmen' | 'veranstaltungen' | 'mitglieder' | 'beitraege_zahlungen';

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'bool'
  | 'date'
  | 'datetime'
  | 'lookup'
  | 'multilookup'
  | 'record'
  | 'multirecord'
  | 'file'
  | 'geo';

export interface FieldRule {
  key: string;
  fulltype: string;
  kind: FieldKind;
  /** From the app's base view. A public page may override this per field. */
  required: boolean;
  /** Build-time label — `labelOf()` prefers the runtime i18n bundle. */
  label: string;
  /** Whether a journey may write it (`file` is upload-only, never via a journey). */
  writable: boolean;
  maxLength?: number;
  /** lookup / multilookup: the ONLY valid write values. */
  options?: string[];
  /** record / multirecord: the target app (always) and its entity key (when inside this appgroup). */
  targetAppId?: string;
  targetEntity?: EntityKey;
  format?: 'currency';
  /** HTML autocomplete token derived from the field name (given-name, email, tel, …). */
  autoComplete?: string;
}

export interface EntityInfo {
  key: EntityKey;
  appId: string;
  label: string;
  /** PascalCase plural — `get<pascal>()` on the service. */
  pascal: string;
  /** The single-record suffix — `create<single>()` on the service. */
  single: string;
}

/** Input-form signals per entity: which data shape each field (pair) has.
 *  `range`  — two date fields that form a stay/period → AvailabilityRangePicker
 *  `choice` — a lookup with few options → ChoiceGroup pills instead of a select
 *  `record` — an applookup → EntitySelectStep with search, never a raw id field
 *  `stock`  — a quantity that has a stock/capacity counterpart → show it, warn on overshoot */
export type Shape =
  | { kind: 'range'; from: string; to: string }
  | { kind: 'choice'; field: string; count: number }
  | { kind: 'record'; field: string; targetEntity?: EntityKey }
  | { kind: 'stock'; field: string };

export const ENTITIES: Record<EntityKey, EntityInfo> = {
  "veranstaltungsteilnahmen": {
    "key": "veranstaltungsteilnahmen",
    "appId": "6a2c05211de15074379308bd",
    "label": "Veranstaltungsteilnahmen",
    "pascal": "Veranstaltungsteilnahmen",
    "single": "VeranstaltungsteilnahmenEntry"
  },
  "veranstaltungen": {
    "key": "veranstaltungen",
    "appId": "6a2c05219a64afeec0949857",
    "label": "Veranstaltungen",
    "pascal": "Veranstaltungen",
    "single": "VeranstaltungenEntry"
  },
  "mitglieder": {
    "key": "mitglieder",
    "appId": "6a2c051add06b14dff7ae846",
    "label": "Mitglieder",
    "pascal": "Mitglieder",
    "single": "MitgliederEntry"
  },
  "beitraege_zahlungen": {
    "key": "beitraege_zahlungen",
    "appId": "6a2c05202232d348547938ed",
    "label": "Beiträge & Zahlungen",
    "pascal": "BeitraegeZahlungen",
    "single": "BeitraegeZahlungenEntry"
  }
};

export const FIELD_RULES: Record<EntityKey, Record<string, FieldRule>> = {
  "veranstaltungsteilnahmen": {
    "mitglied": {
      "key": "mitglied",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Mitglied",
      "writable": true,
      "targetAppId": "6a2c051add06b14dff7ae846",
      "targetEntity": "mitglieder"
    },
    "veranstaltung": {
      "key": "veranstaltung",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Veranstaltung",
      "writable": true,
      "targetAppId": "6a2c05219a64afeec0949857",
      "targetEntity": "veranstaltungen"
    },
    "anmeldedatum": {
      "key": "anmeldedatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Anmeldedatum",
      "writable": true
    },
    "anwesenheit": {
      "key": "anwesenheit",
      "fulltype": "bool",
      "kind": "bool",
      "required": false,
      "label": "Anwesenheit bestätigt",
      "writable": true
    },
    "bemerkungen_teilnahme": {
      "key": "bemerkungen_teilnahme",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Bemerkungen",
      "writable": true
    }
  },
  "veranstaltungen": {
    "titel": {
      "key": "titel",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Titel der Veranstaltung",
      "writable": true,
      "maxLength": 4000
    },
    "beschreibung": {
      "key": "beschreibung",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Beschreibung",
      "writable": true
    },
    "datum_uhrzeit": {
      "key": "datum_uhrzeit",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": true,
      "label": "Datum & Uhrzeit",
      "writable": true
    },
    "anmeldeschluss": {
      "key": "anmeldeschluss",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Anmeldeschluss",
      "writable": true
    },
    "veranstaltungsart": {
      "key": "veranstaltungsart",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Veranstaltungsart",
      "writable": true,
      "options": [
        "vortrag",
        "workshop",
        "mitgliederversammlung",
        "networking",
        "sonstiges"
      ]
    },
    "veranstaltungsort": {
      "key": "veranstaltungsort",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Veranstaltungsort",
      "writable": true,
      "maxLength": 4000
    },
    "max_teilnehmer": {
      "key": "max_teilnehmer",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Maximale Teilnehmerzahl",
      "writable": true
    },
    "verantwortlicher": {
      "key": "verantwortlicher",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Verantwortliche Person",
      "writable": true,
      "maxLength": 4000
    },
    "bemerkungen_veranstaltung": {
      "key": "bemerkungen_veranstaltung",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Bemerkungen",
      "writable": true
    }
  },
  "mitglieder": {
    "geburtsdatum": {
      "key": "geburtsdatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Geburtsdatum",
      "writable": true,
      "autoComplete": "bday"
    },
    "email": {
      "key": "email",
      "fulltype": "string/email",
      "kind": "email",
      "required": true,
      "label": "E-Mail-Adresse",
      "writable": true,
      "autoComplete": "email"
    },
    "telefon": {
      "key": "telefon",
      "fulltype": "string/tel",
      "kind": "tel",
      "required": false,
      "label": "Telefonnummer",
      "writable": true,
      "autoComplete": "tel"
    },
    "strasse": {
      "key": "strasse",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Straße",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "address-line1"
    },
    "hausnummer": {
      "key": "hausnummer",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Hausnummer",
      "writable": true,
      "maxLength": 4000
    },
    "plz": {
      "key": "plz",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Postleitzahl",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "postal-code"
    },
    "ort": {
      "key": "ort",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Ort",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "address-level2"
    },
    "mitgliedsnummer": {
      "key": "mitgliedsnummer",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Mitgliedsnummer",
      "writable": true,
      "maxLength": 4000
    },
    "eintrittsdatum": {
      "key": "eintrittsdatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Eintrittsdatum",
      "writable": true
    },
    "mitgliedsstatus": {
      "key": "mitgliedsstatus",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Mitgliedsstatus",
      "writable": true,
      "options": [
        "passiv",
        "ehrenmitglied",
        "ausgetreten",
        "aktiv"
      ]
    },
    "iban": {
      "key": "iban",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "IBAN (für Lastschrift)",
      "writable": true,
      "maxLength": 4000
    },
    "bemerkungen": {
      "key": "bemerkungen",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Bemerkungen",
      "writable": true
    },
    "vorname": {
      "key": "vorname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Vorname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "given-name"
    },
    "nachname": {
      "key": "nachname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Nachname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "family-name"
    }
  },
  "beitraege_zahlungen": {
    "mitglied": {
      "key": "mitglied",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Mitglied",
      "writable": true,
      "targetAppId": "6a2c051add06b14dff7ae846",
      "targetEntity": "mitglieder"
    },
    "beitragsjahr": {
      "key": "beitragsjahr",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Beitragsjahr",
      "writable": true
    },
    "beitragshoehe": {
      "key": "beitragshoehe",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Beitragshöhe (€)",
      "writable": true,
      "format": "currency"
    },
    "zahlungsart": {
      "key": "zahlungsart",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Zahlungsart",
      "writable": true,
      "options": [
        "ueberweisung",
        "lastschrift",
        "bar"
      ]
    },
    "zahlungsdatum": {
      "key": "zahlungsdatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Zahlungsdatum",
      "writable": true
    },
    "zahlungsstatus": {
      "key": "zahlungsstatus",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Zahlungsstatus",
      "writable": true,
      "options": [
        "offen",
        "bezahlt",
        "gemahnt",
        "storniert"
      ]
    },
    "bemerkungen_zahlung": {
      "key": "bemerkungen_zahlung",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Bemerkungen",
      "writable": true
    }
  }
};

export const SHAPES: Record<EntityKey, Shape[]> = {
  "veranstaltungsteilnahmen": [
    {
      "kind": "record",
      "field": "mitglied",
      "targetEntity": "mitglieder"
    },
    {
      "kind": "record",
      "field": "veranstaltung",
      "targetEntity": "veranstaltungen"
    }
  ],
  "veranstaltungen": [
    {
      "kind": "choice",
      "field": "veranstaltungsart",
      "count": 5
    }
  ],
  "mitglieder": [
    {
      "kind": "choice",
      "field": "mitgliedsstatus",
      "count": 4
    }
  ],
  "beitraege_zahlungen": [
    {
      "kind": "choice",
      "field": "zahlungsart",
      "count": 3
    },
    {
      "kind": "choice",
      "field": "zahlungsstatus",
      "count": 4
    },
    {
      "kind": "record",
      "field": "mitglied",
      "targetEntity": "mitglieder"
    }
  ]
};

export function ruleOf(entity: EntityKey, key: string): FieldRule | undefined {
  return FIELD_RULES[entity]?.[key];
}

/** The field label as the user sees it — runtime bundle first, generated label second. */
export function labelOf(entity: EntityKey, key: string): string {
  const fromBundle = fieldLabel(entity, key);
  if (fromBundle !== key) return fromBundle;
  return ruleOf(entity, key)?.label ?? key;
}

export function entityLabel(entity: EntityKey): string {
  const fromBundle = appLabel(entity);
  if (fromBundle !== entity) return fromBundle;
  return ENTITIES[entity]?.label ?? entity;
}

/** Lookup options with runtime labels — the only legitimate source of `{key,label}` pairs. */
export function optionsOf(entity: EntityKey, key: string): Array<{ key: string; label: string }> {
  const generated = (LOOKUP_OPTIONS as Record<string, Record<string, Array<{ key: string; label: string }>>>)[entity]?.[key];
  if (generated && generated.length) return generated.map(o => ({ key: o.key, label: o.label }));
  const keys = ruleOf(entity, key)?.options ?? [];
  return keys.map(k => ({ key: k, label: lookupLabel(entity, key, k) ?? k }));
}

export function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object' && 'from' in (v as object) && 'to' in (v as object)) {
    const r = v as { from: unknown; to: unknown };
    return isEmptyValue(r.from) && isEmptyValue(r.to);
  }
  return false;
}
