import type { BeitraegeZahlungen, Veranstaltungsteilnahmen } from './app';

export type EnrichedBeitraegeZahlungen = BeitraegeZahlungen & {
  mitgliedName: string;
};

export type EnrichedVeranstaltungsteilnahmen = Veranstaltungsteilnahmen & {
  mitgliedName: string;
  veranstaltungName: string;
};
