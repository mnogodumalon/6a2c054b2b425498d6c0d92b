import type { Veranstaltungsteilnahmen, Mitglieder, Veranstaltungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';

export interface VeranstaltungsteilnahmenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Veranstaltungsteilnahmen;
  /** N:1-Ziel „Mitglieder": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitgliederList: Mitglieder[];
  /** Klick auf die Mitglieder-Relation → overlay.push auf dessen Detail. */
  onOpenMitglieder?: (record: Mitglieder) => void;
  /** N:1-Ziel „Veranstaltungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  veranstaltungenList: Veranstaltungen[];
  /** Klick auf die Veranstaltungen-Relation → overlay.push auf dessen Detail. */
  onOpenVeranstaltungen?: (record: Veranstaltungen) => void;
}

export function VeranstaltungsteilnahmenDetails({
  record,
  mitgliederList,
  onOpenMitglieder,
  veranstaltungenList,
  onOpenVeranstaltungen,
}: VeranstaltungsteilnahmenDetailsProps) {
  const mitgliedTarget = mitgliederList.find(r => r.record_id === extractRecordId(record.fields.mitglied));
  const veranstaltungTarget = veranstaltungenList.find(r => r.record_id === extractRecordId(record.fields.veranstaltung));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Anmeldedatum" value={record.fields.anmeldedatum} format="date" />
        <RecordField label="Anwesenheit bestätigt" value={record.fields.anwesenheit} format="bool" />
        <RecordField label="Bemerkungen" value={record.fields.bemerkungen_teilnahme} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={2}>
        <RecordRelation
          label="Mitglied"
          name={mitgliedTarget?.fields.vorname ?? '—'}
          meta={[mitgliedTarget?.fields.email, mitgliedTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={mitgliedTarget && onOpenMitglieder ? () => onOpenMitglieder!(mitgliedTarget!) : undefined}
        />
        <RecordRelation
          label="Veranstaltung"
          name={veranstaltungTarget?.fields.titel ?? '—'}
          meta={[veranstaltungTarget?.fields.veranstaltungsort, veranstaltungTarget?.fields.verantwortlicher].filter(Boolean).join(' · ') || undefined}
          onClick={veranstaltungTarget && onOpenVeranstaltungen ? () => onOpenVeranstaltungen!(veranstaltungTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.VERANSTALTUNGSTEILNAHMEN} recordId={record.record_id} />
    </>
  );
}
