import type { Veranstaltungen, Veranstaltungsteilnahmen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface VeranstaltungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Veranstaltungen;
  /** 1:N „Veranstaltungsteilnahmen" (veranstaltung): VOLLE Liste — der Block filtert auf diesen Record. */
  veranstaltungsteilnahmenList: Veranstaltungsteilnahmen[];
  /** Zeilen-Klick → overlay.push auf das Veranstaltungsteilnahmen-Detail (nie der Edit-Dialog). */
  onOpenVeranstaltungsteilnahmen: (record: Veranstaltungsteilnahmen) => void;
  /** Kontextuelles „+": öffnet den Veranstaltungsteilnahmen-Dialog mit diesem Record vorgesetzt. */
  onAddVeranstaltungsteilnahmen?: () => void;
}

export function VeranstaltungenDetails({
  record,
  veranstaltungsteilnahmenList,
  onOpenVeranstaltungsteilnahmen,
  onAddVeranstaltungsteilnahmen,
}: VeranstaltungenDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('veranstaltungen', 'titel')} value={record.fields.titel} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'beschreibung')} value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('veranstaltungen', 'datum_uhrzeit')} value={record.fields.datum_uhrzeit} format="datetime" />
        <RecordField label={fieldLabel('veranstaltungen', 'anmeldeschluss')} value={record.fields.anmeldeschluss} format="date" />
        <RecordField label={fieldLabel('veranstaltungen', 'veranstaltungsart')} value={record.fields.veranstaltungsart} format="pill" />
        <RecordField label={fieldLabel('veranstaltungen', 'veranstaltungsort')} value={record.fields.veranstaltungsort} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'max_teilnehmer')} value={record.fields.max_teilnehmer} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'verantwortlicher')} value={record.fields.verantwortlicher} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'bemerkungen_veranstaltung')} value={record.fields.bemerkungen_veranstaltung} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('veranstaltungsteilnahmen')}
        items={veranstaltungsteilnahmenList.filter(r => extractRecordId(r.fields.veranstaltung) === record.record_id)}
        map={r => ({ name: appLabel('veranstaltungsteilnahmen'), meta: r.fields.anmeldedatum })}
        onOpen={onOpenVeranstaltungsteilnahmen}
        onAdd={onAddVeranstaltungsteilnahmen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.VERANSTALTUNGEN} recordId={record.record_id} readOnly={!perms.canWrite('veranstaltungen')} />
    </>
  );
}
