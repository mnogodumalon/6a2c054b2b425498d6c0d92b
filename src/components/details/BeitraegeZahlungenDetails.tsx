import type { BeitraegeZahlungen, Mitglieder } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';

export interface BeitraegeZahlungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: BeitraegeZahlungen;
  /** N:1-Ziel „Mitglieder": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitgliederList: Mitglieder[];
  /** Klick auf die Mitglieder-Relation → overlay.push auf dessen Detail. */
  onOpenMitglieder?: (record: Mitglieder) => void;
}

export function BeitraegeZahlungenDetails({
  record,
  mitgliederList,
  onOpenMitglieder,
}: BeitraegeZahlungenDetailsProps) {
  const mitgliedTarget = mitgliederList.find(r => r.record_id === extractRecordId(record.fields.mitglied));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Beitragsjahr" value={record.fields.beitragsjahr} format="text" />
        <RecordField label="Beitragshöhe (€)" value={record.fields.beitragshoehe} format="text" />
        <RecordField label="Zahlungsart" value={record.fields.zahlungsart} format="pill" />
        <RecordField label="Zahlungsdatum" value={record.fields.zahlungsdatum} format="date" />
        <RecordField label="Zahlungsstatus" value={record.fields.zahlungsstatus} format="pill" />
        <RecordField label="Bemerkungen" value={record.fields.bemerkungen_zahlung} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={1}>
        <RecordRelation
          label="Mitglied"
          name={mitgliedTarget?.fields.vorname ?? '—'}
          meta={[mitgliedTarget?.fields.email, mitgliedTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={mitgliedTarget && onOpenMitglieder ? () => onOpenMitglieder!(mitgliedTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.BEITRAEGE_ZAHLUNGEN} recordId={record.record_id} />
    </>
  );
}
