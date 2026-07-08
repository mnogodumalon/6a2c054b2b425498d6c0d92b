import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Veranstaltungsteilnahmen, Mitglieder, Veranstaltungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { VeranstaltungsteilnahmenDialog } from '@/components/dialogs/VeranstaltungsteilnahmenDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Veranstaltungsteilnahmen';
import { evalComputed } from '@/config/form-enhancements/types';

export default function VeranstaltungsteilnahmenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Veranstaltungsteilnahmen | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mitgliederList, setMitgliederList] = useState<Mitglieder[]>([]);
  const [veranstaltungenList, setVeranstaltungenList] = useState<Veranstaltungen[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, mitgliederData, veranstaltungenData] = await Promise.all([
        LivingAppsService.getVeranstaltungsteilnahmen(),
        LivingAppsService.getMitglieder(),
        LivingAppsService.getVeranstaltungen(),
      ]);
      setMitgliederList(mitgliederData);
      setVeranstaltungenList(veranstaltungenData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Veranstaltungsteilnahmen['fields']) {
    if (!record) return;
    await LivingAppsService.updateVeranstaltungsteilnahmenEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteVeranstaltungsteilnahmenEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/veranstaltungsteilnahmen');
  }

  function getMitgliederDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return mitgliederList.find(r => r.record_id === refId)?.fields.vorname ?? '—';
  }

  function getVeranstaltungenDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return veranstaltungenList.find(r => r.record_id === refId)?.fields.titel ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title="Eintrag nicht gefunden"
        action={
          <Button variant="ghost" onClick={() => navigate('/veranstaltungsteilnahmen')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            Zurück
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/veranstaltungsteilnahmen')}
      onEdit={() => setEditing(true)}
      backLabel="Zurück"
      editLabel="Bearbeiten"
    >
      <RecordHeader title={'Veranstaltungsteilnahmen'} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          mitglied: mitgliederList,
          veranstaltung: veranstaltungenList,
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

      <RecordSection title="Details" cols={2}>
        <RecordField label="Mitglied" value={getMitgliederDisplayName(record.fields.mitglied)} format="text" />
        <RecordField label="Veranstaltung" value={getVeranstaltungenDisplayName(record.fields.veranstaltung)} format="text" />
        <RecordField label="Anmeldedatum" value={record.fields.anmeldedatum} format="date" />
        <RecordField label="Anwesenheit bestätigt" value={record.fields.anwesenheit} format="bool" />
        <RecordField label="Bemerkungen" value={record.fields.bemerkungen_teilnahme} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.VERANSTALTUNGSTEILNAHMEN} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          Löschen
        </Button>
      </div>

      <VeranstaltungsteilnahmenDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        mitgliederList={mitgliederList}
        veranstaltungenList={veranstaltungenList}
        enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungsteilnahmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungsteilnahmen']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Veranstaltungsteilnahmen löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </RecordView>
  );
}
