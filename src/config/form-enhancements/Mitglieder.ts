import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    { row: ['vorname', 'nachname'] },
    'geburtsdatum',
    'email',
    'telefon',
    { row: ['strasse', 'hausnummer'], cols: '2fr 1fr' },
    { row: ['plz', 'ort'], cols: '1fr 2fr' },
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
