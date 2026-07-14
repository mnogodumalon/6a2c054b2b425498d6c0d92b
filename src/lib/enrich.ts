import type { EnrichedBeitraegeZahlungen, EnrichedVeranstaltungsteilnahmen } from '@/types/enriched';
import type { BeitraegeZahlungen, Mitglieder, Veranstaltungen, Veranstaltungsteilnahmen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface VeranstaltungsteilnahmenMaps {
  mitgliederMap: Map<string, Mitglieder>;
  veranstaltungenMap: Map<string, Veranstaltungen>;
}

export function enrichVeranstaltungsteilnahmen(
  veranstaltungsteilnahmen: Veranstaltungsteilnahmen[],
  maps: VeranstaltungsteilnahmenMaps
): EnrichedVeranstaltungsteilnahmen[] {
  return veranstaltungsteilnahmen.map(r => ({
    ...r,
    mitgliedName: resolveDisplay(r.fields.mitglied, maps.mitgliederMap, 'vorname', 'nachname'),
    veranstaltungName: resolveDisplay(r.fields.veranstaltung, maps.veranstaltungenMap, 'titel'),
  }));
}

interface BeitraegeZahlungenMaps {
  mitgliederMap: Map<string, Mitglieder>;
}

export function enrichBeitraegeZahlungen(
  beitraegeZahlungen: BeitraegeZahlungen[],
  maps: BeitraegeZahlungenMaps
): EnrichedBeitraegeZahlungen[] {
  return beitraegeZahlungen.map(r => ({
    ...r,
    mitgliedName: resolveDisplay(r.fields.mitglied, maps.mitgliederMap, 'vorname', 'nachname'),
  }));
}
