import type { Veranstaltungen, Veranstaltungsteilnahmen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface VeranstaltungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Veranstaltungen;
  /** 1:N „Veranstaltungsteilnahmen": VOLLE Liste — der Block filtert auf diesen Record. */
  veranstaltungsteilnahmenList: Veranstaltungsteilnahmen[];
  /** Zeilen-Klick → overlay.push auf das Veranstaltungsteilnahmen-Detail (nie der Edit-Dialog). */
  onOpenVeranstaltungsteilnahmen: (record: Veranstaltungsteilnahmen) => void;
  /** Kontextuelles „+": öffnet den Veranstaltungsteilnahmen-Dialog mit diesem Record vorgesetzt. */
  onAddVeranstaltungsteilnahmen: () => void;
}

export function VeranstaltungenDetails({
  record,
  veranstaltungsteilnahmenList,
  onOpenVeranstaltungsteilnahmen,
  onAddVeranstaltungsteilnahmen,
}: VeranstaltungenDetailsProps) {
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Titel der Veranstaltung" value={record.fields.titel} format="text" />
        <RecordField label="Beschreibung" value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label="Datum & Uhrzeit" value={record.fields.datum_uhrzeit} format="datetime" />
        <RecordField label="Anmeldeschluss" value={record.fields.anmeldeschluss} format="date" />
        <RecordField label="Veranstaltungsart" value={record.fields.veranstaltungsart} format="pill" />
        <RecordField label="Veranstaltungsort" value={record.fields.veranstaltungsort} format="text" />
        <RecordField label="Maximale Teilnehmerzahl" value={record.fields.max_teilnehmer} format="text" />
        <RecordField label="Verantwortliche Person" value={record.fields.verantwortlicher} format="text" />
        <RecordField label="Bemerkungen" value={record.fields.bemerkungen_veranstaltung} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title="Veranstaltungsteilnahmen"
        items={veranstaltungsteilnahmenList.filter(r => extractRecordId(r.fields.veranstaltung) === record.record_id)}
        map={r => ({ name: 'Veranstaltungsteilnahmen', meta: r.fields.anmeldedatum })}
        onOpen={onOpenVeranstaltungsteilnahmen}
        onAdd={onAddVeranstaltungsteilnahmen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.VERANSTALTUNGEN} recordId={record.record_id} />
    </>
  );
}
