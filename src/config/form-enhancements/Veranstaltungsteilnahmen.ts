import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'mitglied',
    'veranstaltung',
    'anmeldedatum',
    'anwesenheit',
    'bemerkungen_teilnahme',
  ],
  defaults: {
    'anmeldedatum': { kind: 'today' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};

export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
