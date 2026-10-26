import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'mitglied',
    'beitragsjahr',
    'beitragshoehe',
    'zahlungsart',
    'zahlungsdatum',
    'zahlungsstatus',
    'bemerkungen_zahlung',
  ],
  defaults: {
    'beitragsjahr': { kind: 'currentYear' },
    'zahlungsstatus': { kind: 'lookup', key: 'offen', label: 'Offen' },
    'zahlungsart': { kind: 'lookup', key: 'ueberweisung', label: 'Überweisung' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
