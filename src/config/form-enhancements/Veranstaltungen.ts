import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'titel',
    'veranstaltungsart',
    'beschreibung',
    { row: ['datum_uhrzeit', 'anmeldeschluss'] },
    'veranstaltungsort',
    'max_teilnehmer',
    'verantwortlicher',
    'bemerkungen_veranstaltung',
  ],
  defaults: {
    'datum_uhrzeit': { kind: 'todayOffset', days: 7, withTime: true },
    'anmeldeschluss': { kind: 'todayOffset', days: 5 },
    'veranstaltungsart': { kind: 'lookup', key: 'vortrag', label: 'Vortrag' },
    'max_teilnehmer': { kind: 'literal', value: 20 },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};

export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
