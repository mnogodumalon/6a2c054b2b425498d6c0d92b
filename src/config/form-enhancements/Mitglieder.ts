import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'vorname',
    'nachname',
    'email',
    'telefon',
    'geburtsdatum',
    'strasse',
    'hausnummer',
    'plz',
    'ort',
    'mitgliedsnummer',
    'eintrittsdatum',
    'mitgliedsstatus',
    'iban',
    'bemerkungen',
  ],
  defaults: {
    'eintrittsdatum': { kind: 'today' },
    'mitgliedsstatus': { kind: 'lookup', key: 'aktiv', label: 'Aktiv' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
