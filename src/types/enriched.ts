import type { BeitraegeZahlungen, Veranstaltungsteilnahmen } from './app';

export type EnrichedVeranstaltungsteilnahmen = Veranstaltungsteilnahmen & {
  mitgliedName: string;
  veranstaltungName: string;
};

export type EnrichedBeitraegeZahlungen = BeitraegeZahlungen & {
  mitgliedName: string;
};
