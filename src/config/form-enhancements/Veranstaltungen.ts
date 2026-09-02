import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'titel',
    'veranstaltungsart',
    'datum_uhrzeit',
    'anmeldeschluss',
    'veranstaltungsort',
    'max_teilnehmer',
    'verantwortlicher',
    'beschreibung',
    'bemerkungen_veranstaltung',
  ],
  defaults: {
    'datum_uhrzeit': { kind: 'today', withTime: true },
    'anmeldeschluss': { kind: 'todayOffset', days: -7, withTime: false },
    'veranstaltungsart': { kind: 'lookup', key: 'vortrag', label: 'Vortrag' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
