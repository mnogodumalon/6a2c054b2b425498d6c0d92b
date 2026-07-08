import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'mitglied',
    'beitragsjahr',
    { row: ['beitragshoehe', 'zahlungsart'] },
    'zahlungsdatum',
    'zahlungsstatus',
    'bemerkungen_zahlung',
  ],
  defaults: {
    'beitragsjahr': { kind: 'literal', value: 2026 },
    'zahlungsdatum': { kind: 'today' },
    'zahlungsstatus': { kind: 'lookup', key: 'offen', label: 'Offen' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};

export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
