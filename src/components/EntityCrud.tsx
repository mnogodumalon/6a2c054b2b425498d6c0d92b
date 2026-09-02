/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'veranstaltungsteilnahmen'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.veranstaltungsteilnahmen.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.veranstaltungsteilnahmen.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.veranstaltungsteilnahmen.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.veranstaltungsteilnahmen              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   veranstaltungsteilnahmen: mitglied, veranstaltung, anmeldedatum, anwesenheit, bemerkungen_teilnahme  ·  → mitglieder · → veranstaltungen
 *   veranstaltungen: titel, beschreibung, datum_uhrzeit, anmeldeschluss, veranstaltungsart, veranstaltungsort, max_teilnehmer, verantwortlicher, …  ·  ← veranstaltungsteilnahmen (list + contextual +)
 *   mitglieder: geburtsdatum, email, telefon, strasse, hausnummer, plz, ort, mitgliedsnummer, …  ·  ← veranstaltungsteilnahmen (list + contextual +) · ← beitraege_zahlungen (list + contextual +)
 *   beitraege_zahlungen: mitglied, beitragsjahr, beitragshoehe, zahlungsart, zahlungsdatum, zahlungsstatus, bemerkungen_zahlung  ·  → mitglieder
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Veranstaltungsteilnahmen, Veranstaltungen, Mitglieder, BeitraegeZahlungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichVeranstaltungsteilnahmen, enrichBeitraegeZahlungen } from '@/lib/enrich';
import type { EnrichedVeranstaltungsteilnahmen, EnrichedBeitraegeZahlungen } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { VeranstaltungsteilnahmenDialog, type VeranstaltungsteilnahmenDialogDefaults } from '@/components/dialogs/VeranstaltungsteilnahmenDialog';
import { VeranstaltungsteilnahmenDetails } from '@/components/details/VeranstaltungsteilnahmenDetails';
import { VeranstaltungenDialog, type VeranstaltungenDialogDefaults } from '@/components/dialogs/VeranstaltungenDialog';
import { VeranstaltungenDetails } from '@/components/details/VeranstaltungenDetails';
import { MitgliederDialog, type MitgliederDialogDefaults } from '@/components/dialogs/MitgliederDialog';
import { MitgliederDetails } from '@/components/details/MitgliederDetails';
import { BeitraegeZahlungenDialog, type BeitraegeZahlungenDialogDefaults } from '@/components/dialogs/BeitraegeZahlungenDialog';
import { BeitraegeZahlungenDetails } from '@/components/details/BeitraegeZahlungenDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'veranstaltungsteilnahmen'; record: EnrichedVeranstaltungsteilnahmen }
  | { type: 'veranstaltungen'; record: Veranstaltungen }
  | { type: 'mitglieder'; record: Mitglieder }
  | { type: 'beitraegeZahlungen'; record: EnrichedBeitraegeZahlungen };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  veranstaltungsteilnahmen: EntityCrudApi<Veranstaltungsteilnahmen, VeranstaltungsteilnahmenDialogDefaults>;
  veranstaltungen: EntityCrudApi<Veranstaltungen, VeranstaltungenDialogDefaults>;
  mitglieder: EntityCrudApi<Mitglieder, MitgliederDialogDefaults>;
  beitraegeZahlungen: EntityCrudApi<BeitraegeZahlungen, BeitraegeZahlungenDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { veranstaltungsteilnahmen: EnrichedVeranstaltungsteilnahmen[]; veranstaltungen: Veranstaltungen[]; mitglieder: Mitglieder[]; beitraegeZahlungen: EnrichedBeitraegeZahlungen[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [veranstaltungsteilnahmenDialog, setVeranstaltungsteilnahmenDialog] = useState<{ defaults?: VeranstaltungsteilnahmenDialogDefaults; editing?: Veranstaltungsteilnahmen } | null>(null);
  const [veranstaltungenDialog, setVeranstaltungenDialog] = useState<{ defaults?: VeranstaltungenDialogDefaults; editing?: Veranstaltungen } | null>(null);
  const [mitgliederDialog, setMitgliederDialog] = useState<{ defaults?: MitgliederDialogDefaults; editing?: Mitglieder } | null>(null);
  const [beitraegeZahlungenDialog, setBeitraegeZahlungenDialog] = useState<{ defaults?: BeitraegeZahlungenDialogDefaults; editing?: BeitraegeZahlungen } | null>(null);
  const enrichedVeranstaltungsteilnahmen = useMemo(() => enrichVeranstaltungsteilnahmen(data.veranstaltungsteilnahmen, { mitgliederMap: data.mitgliederMap, veranstaltungenMap: data.veranstaltungenMap }), [data.veranstaltungsteilnahmen, data.mitgliederMap, data.veranstaltungenMap]);
  const enrichedBeitraegeZahlungen = useMemo(() => enrichBeitraegeZahlungen(data.beitraegeZahlungen, { mitgliederMap: data.mitgliederMap }), [data.beitraegeZahlungen, data.mitgliederMap]);

  function detailVeranstaltungsteilnahmen(record: Veranstaltungsteilnahmen, push = false) {
    const rec = enrichedVeranstaltungsteilnahmen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'veranstaltungsteilnahmen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitVeranstaltungsteilnahmen(fields: Veranstaltungsteilnahmen['fields']) {
    const editing = veranstaltungsteilnahmenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setVeranstaltungsteilnahmen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateVeranstaltungsteilnahmenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('veranstaltungsteilnahmen')} — ${t('crud_updated')}`, async () => {
        data.setVeranstaltungsteilnahmen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateVeranstaltungsteilnahmenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createVeranstaltungsteilnahmenEntry(fields);
      undoToast(`${appLabel('veranstaltungsteilnahmen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailVeranstaltungen(record: Veranstaltungen, push = false) {
    const item: OverlayItem = { type: 'veranstaltungen', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitVeranstaltungen(fields: Veranstaltungen['fields']) {
    const editing = veranstaltungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setVeranstaltungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateVeranstaltungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('veranstaltungen')} — ${t('crud_updated')}`, async () => {
        data.setVeranstaltungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateVeranstaltungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createVeranstaltungenEntry(fields);
      undoToast(`${appLabel('veranstaltungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailMitglieder(record: Mitglieder, push = false) {
    const item: OverlayItem = { type: 'mitglieder', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitMitglieder(fields: Mitglieder['fields']) {
    const editing = mitgliederDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setMitglieder(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateMitgliederEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('mitglieder')} — ${t('crud_updated')}`, async () => {
        data.setMitglieder(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateMitgliederEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createMitgliederEntry(fields);
      undoToast(`${appLabel('mitglieder')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailBeitraegeZahlungen(record: BeitraegeZahlungen, push = false) {
    const rec = enrichedBeitraegeZahlungen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'beitraegeZahlungen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitBeitraegeZahlungen(fields: BeitraegeZahlungen['fields']) {
    const editing = beitraegeZahlungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setBeitraegeZahlungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateBeitraegeZahlungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('beitraege_zahlungen')} — ${t('crud_updated')}`, async () => {
        data.setBeitraegeZahlungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateBeitraegeZahlungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createBeitraegeZahlungenEntry(fields);
      undoToast(`${appLabel('beitraege_zahlungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <VeranstaltungsteilnahmenDialog
        open={veranstaltungsteilnahmenDialog !== null}
        onClose={() => setVeranstaltungsteilnahmenDialog(null)}
        onSubmit={submitVeranstaltungsteilnahmen}
        defaultValues={veranstaltungsteilnahmenDialog?.defaults}
        recordId={veranstaltungsteilnahmenDialog?.editing?.record_id}
        mitgliederList={data.mitglieder}
        veranstaltungenList={data.veranstaltungen}
        enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungsteilnahmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungsteilnahmen']}
      />
      <VeranstaltungenDialog
        open={veranstaltungenDialog !== null}
        onClose={() => setVeranstaltungenDialog(null)}
        onSubmit={submitVeranstaltungen}
        defaultValues={veranstaltungenDialog?.defaults}
        recordId={veranstaltungenDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungen']}
      />
      <MitgliederDialog
        open={mitgliederDialog !== null}
        onClose={() => setMitgliederDialog(null)}
        onSubmit={submitMitglieder}
        defaultValues={mitgliederDialog?.defaults}
        recordId={mitgliederDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Mitglieder']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Mitglieder']}
      />
      <BeitraegeZahlungenDialog
        open={beitraegeZahlungenDialog !== null}
        onClose={() => setBeitraegeZahlungenDialog(null)}
        onSubmit={submitBeitraegeZahlungen}
        defaultValues={beitraegeZahlungenDialog?.defaults}
        recordId={beitraegeZahlungenDialog?.editing?.record_id}
        mitgliederList={data.mitglieder}
        enablePhotoScan={AI_PHOTO_SCAN['BeitraegeZahlungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['BeitraegeZahlungen']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'veranstaltungsteilnahmen') {
            return (
              <>
                <RecordHeader title={appLabel('veranstaltungsteilnahmen')} subtitle={top.record.fields.anmeldedatum ? formatDate(top.record.fields.anmeldedatum) : undefined} />
                <VeranstaltungsteilnahmenDetails
                  record={top.record}
                  mitgliederList={data.mitglieder}
                  onOpenMitglieder={(r) => detailMitglieder(r, true)}
                  veranstaltungenList={data.veranstaltungen}
                  onOpenVeranstaltungen={(r) => detailVeranstaltungen(r, true)}
                />
              </>
            );
          }
          if (top.type === 'veranstaltungen') {
            return (
              <>
                <RecordHeader title={top.record.fields.titel ?? appLabel('veranstaltungen')} subtitle={top.record.fields.datum_uhrzeit ? formatDate(top.record.fields.datum_uhrzeit) : undefined} />
                <VeranstaltungenDetails
                  record={top.record}
                  veranstaltungsteilnahmenList={data.veranstaltungsteilnahmen}
                  onOpenVeranstaltungsteilnahmen={(r) => detailVeranstaltungsteilnahmen(r, true)}
                  onAddVeranstaltungsteilnahmen={() => setVeranstaltungsteilnahmenDialog({ defaults: { veranstaltung: createRecordUrl(APP_IDS.VERANSTALTUNGEN, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'mitglieder') {
            return (
              <>
                <RecordHeader title={top.record.fields.email ?? appLabel('mitglieder')} subtitle={top.record.fields.geburtsdatum ? formatDate(top.record.fields.geburtsdatum) : undefined} />
                <MitgliederDetails
                  record={top.record}
                  veranstaltungsteilnahmenList={data.veranstaltungsteilnahmen}
                  onOpenVeranstaltungsteilnahmen={(r) => detailVeranstaltungsteilnahmen(r, true)}
                  onAddVeranstaltungsteilnahmen={() => setVeranstaltungsteilnahmenDialog({ defaults: { mitglied: createRecordUrl(APP_IDS.MITGLIEDER, top.record.record_id) } })}
                  beitraegeZahlungenList={data.beitraegeZahlungen}
                  onOpenBeitraegeZahlungen={(r) => detailBeitraegeZahlungen(r, true)}
                  onAddBeitraegeZahlungen={() => setBeitraegeZahlungenDialog({ defaults: { mitglied: createRecordUrl(APP_IDS.MITGLIEDER, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'beitraegeZahlungen') {
            return (
              <>
                <RecordHeader title={appLabel('beitraege_zahlungen')} subtitle={top.record.fields.zahlungsdatum ? formatDate(top.record.fields.zahlungsdatum) : undefined} />
                <BeitraegeZahlungenDetails
                  record={top.record}
                  mitgliederList={data.mitglieder}
                  onOpenMitglieder={(r) => detailMitglieder(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'veranstaltungsteilnahmen') setVeranstaltungsteilnahmenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'veranstaltungen') setVeranstaltungenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'mitglieder') setMitgliederDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'beitraegeZahlungen') setBeitraegeZahlungenDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    veranstaltungsteilnahmen: {
      openCreate: (defaults?: VeranstaltungsteilnahmenDialogDefaults) => setVeranstaltungsteilnahmenDialog({ defaults }),
      openEdit: (record: Veranstaltungsteilnahmen) => setVeranstaltungsteilnahmenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Veranstaltungsteilnahmen) => detailVeranstaltungsteilnahmen(record, false),
    },
    veranstaltungen: {
      openCreate: (defaults?: VeranstaltungenDialogDefaults) => setVeranstaltungenDialog({ defaults }),
      openEdit: (record: Veranstaltungen) => setVeranstaltungenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Veranstaltungen) => detailVeranstaltungen(record, false),
    },
    mitglieder: {
      openCreate: (defaults?: MitgliederDialogDefaults) => setMitgliederDialog({ defaults }),
      openEdit: (record: Mitglieder) => setMitgliederDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Mitglieder) => detailMitglieder(record, false),
    },
    beitraegeZahlungen: {
      openCreate: (defaults?: BeitraegeZahlungenDialogDefaults) => setBeitraegeZahlungenDialog({ defaults }),
      openEdit: (record: BeitraegeZahlungen) => setBeitraegeZahlungenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: BeitraegeZahlungen) => detailBeitraegeZahlungen(record, false),
    },
    enriched: { veranstaltungsteilnahmen: enrichedVeranstaltungsteilnahmen, veranstaltungen: data.veranstaltungen, mitglieder: data.mitglieder, beitraegeZahlungen: enrichedBeitraegeZahlungen },
  };
}
