import type { Mitglieder, BeitraegeZahlungen, Veranstaltungsteilnahmen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface MitgliederDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Mitglieder;
  /** 1:N „Beiträge & Zahlungen": VOLLE Liste — der Block filtert auf diesen Record. */
  beitraegeZahlungenList: BeitraegeZahlungen[];
  /** Zeilen-Klick → overlay.push auf das BeitraegeZahlungen-Detail (nie der Edit-Dialog). */
  onOpenBeitraegeZahlungen: (record: BeitraegeZahlungen) => void;
  /** Kontextuelles „+": öffnet den BeitraegeZahlungen-Dialog mit diesem Record vorgesetzt. */
  onAddBeitraegeZahlungen: () => void;
  /** 1:N „Veranstaltungsteilnahmen": VOLLE Liste — der Block filtert auf diesen Record. */
  veranstaltungsteilnahmenList: Veranstaltungsteilnahmen[];
  /** Zeilen-Klick → overlay.push auf das Veranstaltungsteilnahmen-Detail (nie der Edit-Dialog). */
  onOpenVeranstaltungsteilnahmen: (record: Veranstaltungsteilnahmen) => void;
  /** Kontextuelles „+": öffnet den Veranstaltungsteilnahmen-Dialog mit diesem Record vorgesetzt. */
  onAddVeranstaltungsteilnahmen: () => void;
}

export function MitgliederDetails({
  record,
  beitraegeZahlungenList,
  onOpenBeitraegeZahlungen,
  onAddBeitraegeZahlungen,
  veranstaltungsteilnahmenList,
  onOpenVeranstaltungsteilnahmen,
  onAddVeranstaltungsteilnahmen,
}: MitgliederDetailsProps) {
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Geburtsdatum" value={record.fields.geburtsdatum} format="date" />
        <RecordField label="E-Mail-Adresse" value={record.fields.email} format="email" />
        <RecordField label="Telefonnummer" value={record.fields.telefon} format="text" />
        <RecordField label="Straße" value={record.fields.strasse} format="text" />
        <RecordField label="Hausnummer" value={record.fields.hausnummer} format="text" />
        <RecordField label="Postleitzahl" value={record.fields.plz} format="text" />
        <RecordField label="Ort" value={record.fields.ort} format="text" />
        <RecordField label="Mitgliedsnummer" value={record.fields.mitgliedsnummer} format="text" />
        <RecordField label="Eintrittsdatum" value={record.fields.eintrittsdatum} format="date" />
        <RecordField label="Mitgliedsstatus" value={record.fields.mitgliedsstatus} format="pill" />
        <RecordField label="IBAN (für Lastschrift)" value={record.fields.iban} format="text" />
        <RecordField label="Bemerkungen" value={record.fields.bemerkungen} format="longtext" className="md:col-span-2" />
        <RecordField label="Vorname" value={record.fields.vorname} format="text" />
        <RecordField label="Nachname" value={record.fields.nachname} format="text" />
      </RecordSection>

      <SatelliteSection
        title="Beiträge & Zahlungen"
        items={beitraegeZahlungenList.filter(r => extractRecordId(r.fields.mitglied) === record.record_id)}
        map={r => ({ name: 'Beiträge & Zahlungen', meta: r.fields.zahlungsdatum })}
        onOpen={onOpenBeitraegeZahlungen}
        onAdd={onAddBeitraegeZahlungen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title="Veranstaltungsteilnahmen"
        items={veranstaltungsteilnahmenList.filter(r => extractRecordId(r.fields.mitglied) === record.record_id)}
        map={r => ({ name: 'Veranstaltungsteilnahmen', meta: r.fields.anmeldedatum })}
        onOpen={onOpenVeranstaltungsteilnahmen}
        onAdd={onAddVeranstaltungsteilnahmen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.MITGLIEDER} recordId={record.record_id} />
    </>
  );
}
