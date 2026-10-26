import type { Mitglieder, Veranstaltungsteilnahmen, BeitraegeZahlungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface MitgliederDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Mitglieder;
  /** 1:N „Veranstaltungsteilnahmen" (mitglied): VOLLE Liste — der Block filtert auf diesen Record. */
  veranstaltungsteilnahmenList: Veranstaltungsteilnahmen[];
  /** Zeilen-Klick → overlay.push auf das Veranstaltungsteilnahmen-Detail (nie der Edit-Dialog). */
  onOpenVeranstaltungsteilnahmen: (record: Veranstaltungsteilnahmen) => void;
  /** Kontextuelles „+": öffnet den Veranstaltungsteilnahmen-Dialog mit diesem Record vorgesetzt. */
  onAddVeranstaltungsteilnahmen?: () => void;
  /** 1:N „Beiträge & Zahlungen" (mitglied): VOLLE Liste — der Block filtert auf diesen Record. */
  beitraegeZahlungenList: BeitraegeZahlungen[];
  /** Zeilen-Klick → overlay.push auf das BeitraegeZahlungen-Detail (nie der Edit-Dialog). */
  onOpenBeitraegeZahlungen: (record: BeitraegeZahlungen) => void;
  /** Kontextuelles „+": öffnet den BeitraegeZahlungen-Dialog mit diesem Record vorgesetzt. */
  onAddBeitraegeZahlungen?: () => void;
}

export function MitgliederDetails({
  record,
  veranstaltungsteilnahmenList,
  onOpenVeranstaltungsteilnahmen,
  onAddVeranstaltungsteilnahmen,
  beitraegeZahlungenList,
  onOpenBeitraegeZahlungen,
  onAddBeitraegeZahlungen,
}: MitgliederDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('mitglieder', 'geburtsdatum')} value={record.fields.geburtsdatum} format="date" />
        <RecordField label={fieldLabel('mitglieder', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('mitglieder', 'telefon')} value={record.fields.telefon} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'strasse')} value={record.fields.strasse} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'hausnummer')} value={record.fields.hausnummer} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'plz')} value={record.fields.plz} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'mitgliedsnummer')} value={record.fields.mitgliedsnummer} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'eintrittsdatum')} value={record.fields.eintrittsdatum} format="date" />
        <RecordField label={fieldLabel('mitglieder', 'mitgliedsstatus')} value={record.fields.mitgliedsstatus} format="pill" />
        <RecordField label={fieldLabel('mitglieder', 'iban')} value={record.fields.iban} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'bemerkungen')} value={record.fields.bemerkungen} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('mitglieder', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'nachname')} value={record.fields.nachname} format="text" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('veranstaltungsteilnahmen')}
        items={veranstaltungsteilnahmenList.filter(r => extractRecordId(r.fields.mitglied) === record.record_id)}
        map={r => ({ name: appLabel('veranstaltungsteilnahmen'), meta: r.fields.anmeldedatum })}
        onOpen={onOpenVeranstaltungsteilnahmen}
        onAdd={onAddVeranstaltungsteilnahmen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('beitraege_zahlungen')}
        items={beitraegeZahlungenList.filter(r => extractRecordId(r.fields.mitglied) === record.record_id)}
        map={r => ({ name: appLabel('beitraege_zahlungen'), meta: r.fields.zahlungsdatum })}
        onOpen={onOpenBeitraegeZahlungen}
        onAdd={onAddBeitraegeZahlungen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.MITGLIEDER} recordId={record.record_id} readOnly={!perms.canWrite('mitglieder')} />
    </>
  );
}
