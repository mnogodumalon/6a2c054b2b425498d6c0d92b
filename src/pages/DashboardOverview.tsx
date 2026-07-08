import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBeitraegeZahlungen, enrichVeranstaltungsteilnahmen } from '@/lib/enrich';
import type { EnrichedBeitraegeZahlungen } from '@/types/enriched';
import type { Veranstaltungen, Mitglieder } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatDateTime, formatCurrency, lookupKey } from '@/lib/formatters';
import { useState, useMemo, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatCard, StatCardRow } from '@/components/StatCard';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { KanbanWidget } from '@/components/widgets/KanbanWidget';
import type { KanbanCard, KanbanColumn } from '@/components/widgets/KanbanWidget';
import {
  RecordOverlay,
  RecordHeader,
  RecordKeyFacts,
  RecordSection,
  RecordField,
  RecordAttachments,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { BeitraegeZahlungenDialog } from '@/components/dialogs/BeitraegeZahlungenDialog';
import { VeranstaltungenDialog } from '@/components/dialogs/VeranstaltungenDialog';
import { MitgliederDialog } from '@/components/dialogs/MitgliederDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, ENTRANCE, entranceDelay, undoToast } from '@/lib/polish';
import { format, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck, IconCash,
  IconCalendarEvent, IconUsers, IconPlus, IconMoodHappy, IconBuildingCommunity,
  IconClock,
} from '@tabler/icons-react';
import { IconAlertTriangle } from '@tabler/icons-react';

const APPGROUP_ID = '6a2c054b2b425498d6c0d92b';
const REPAIR_ENDPOINT = '/claude/build/repair';

// Overlay item types
type OverlayItem =
  | { type: 'zahlung'; id: string }
  | { type: 'veranstaltung'; id: string }
  | { type: 'mitglied'; id: string };

export default function DashboardOverview() {
  const {
    beitraegeZahlungen, setBeitraegeZahlungen,
    veranstaltungen,
    veranstaltungsteilnahmen,
    mitglieder,
    veranstaltungenMap, mitgliederMap,
    loading, error, fetchAll,
  } = useDashboardData();

  // ALL hooks before early returns
  const clock = useClock();

  const enrichedBeitraege = useMemo(
    () => enrichBeitraegeZahlungen(beitraegeZahlungen, { mitgliederMap }),
    [beitraegeZahlungen, mitgliederMap],
  );

  const enrichedTeilnahmen = useMemo(
    () => enrichVeranstaltungsteilnahmen(veranstaltungsteilnahmen, { mitgliederMap, veranstaltungenMap }),
    [veranstaltungsteilnahmen, mitgliederMap, veranstaltungenMap],
  );

  const today = useMemo(() => startOfDay(clock), [clock]);
  const todayKey = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);

  // KPI filter state
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Dialog state
  const [zahlungDialog, setZahlungDialog] = useState<{ open: boolean; record: EnrichedBeitraegeZahlungen | null; defaultStatus?: string }>({ open: false, record: null });
  const [veranstDialog, setVeranstDialog] = useState<{ open: boolean; record: Veranstaltungen | null }>({ open: false, record: null });
  const [mitgliedDialog, setMitgliedDialog] = useState<{ open: boolean; record: Mitglieder | null }>({ open: false, record: null });

  // Overlay stack
  const overlay = useRecordOverlayStack<OverlayItem>();

  // Computed data
  const offeneZahlungen = useMemo(
    () => enrichedBeitraege.filter(b => lookupKey(b.fields.zahlungsstatus) === 'offen'),
    [enrichedBeitraege],
  );
  const gemahnte = useMemo(
    () => enrichedBeitraege.filter(b => lookupKey(b.fields.zahlungsstatus) === 'gemahnt'),
    [enrichedBeitraege],
  );
  const aktiveMitglieder = useMemo(
    () => mitglieder.filter(m => lookupKey(m.fields.mitgliedsstatus) === 'aktiv'),
    [mitglieder],
  );
  const naechsteVeranstaltungen = useMemo(
    () => veranstaltungen
      .filter(v => v.fields.datum_uhrzeit && !isBefore(parseISO(v.fields.datum_uhrzeit), today))
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '').localeCompare(b.fields.datum_uhrzeit ?? ''))
      .slice(0, 5),
    [veranstaltungen, today],
  );

  // Kanban columns for Zahlungsstatus
  const kanbanColumns: KanbanColumn[] = useMemo(
    () => (LOOKUP_OPTIONS['beitraege_zahlungen']?.['zahlungsstatus'] ?? []).map(o => ({
      key: o.key,
      label: o.label,
      tone: o.key === 'bezahlt' ? 'success' as const
        : o.key === 'gemahnt' ? 'warning' as const
        : o.key === 'storniert' ? 'destructive' as const
        : 'default' as const,
    })),
    [],
  );

  const filteredBeitraege = useMemo(
    () => statusFilter
      ? enrichedBeitraege.filter(b => lookupKey(b.fields.zahlungsstatus) === statusFilter)
      : enrichedBeitraege,
    [enrichedBeitraege, statusFilter],
  );

  const kanbanCards: KanbanCard[] = useMemo(
    () => filteredBeitraege.map(b => ({
      id: b.record_id,
      column: lookupKey(b.fields.zahlungsstatus) ?? '',
      title: b.mitgliedName || `Mitglied ${b.record_id.slice(-4)}`,
      subtitle: [
        b.fields.beitragsjahr ? `${b.fields.beitragsjahr}` : null,
        b.fields.beitragshoehe != null ? formatCurrency(b.fields.beitragshoehe) : null,
      ].filter(Boolean).join(' · ') || undefined,
      tone: lookupKey(b.fields.zahlungsstatus) === 'gemahnt' ? 'warning' as const
        : lookupKey(b.fields.zahlungsstatus) === 'bezahlt' ? 'success' as const
        : lookupKey(b.fields.zahlungsstatus) === 'storniert' ? 'destructive' as const
        : 'default' as const,
    })),
    [filteredBeitraege],
  );

  // Advance zahlung status optimistically
  const advanceZahlung = useCallback(async (id: string, newStatus: string) => {
    const prev = beitraegeZahlungen.find(b => b.record_id === id);
    const prevStatus = prev ? lookupKey(prev.fields.zahlungsstatus) : undefined;
    // Optimistic update
    setBeitraegeZahlungen(curr => curr.map(b =>
      b.record_id === id ? { ...b, fields: { ...b.fields, zahlungsstatus: { key: newStatus, label: newStatus } } } : b,
    ));
    LivingAppsService.updateBeitraegeZahlungenEntry(id, { zahlungsstatus: newStatus }).catch(() => {
      fetchAll();
    });
    undoToast(
      `Status auf "${kanbanColumns.find(c => c.key === newStatus)?.label ?? newStatus}" gesetzt`,
      () => {
        if (prevStatus) {
          setBeitraegeZahlungen(curr => curr.map(b =>
            b.record_id === id ? { ...b, fields: { ...b.fields, zahlungsstatus: { key: prevStatus, label: prevStatus } } } : b,
          ));
          LivingAppsService.updateBeitraegeZahlungenEntry(id, { zahlungsstatus: prevStatus }).catch(() => fetchAll());
        }
      },
    );
  }, [beitraegeZahlungen, setBeitraegeZahlungen, fetchAll, kanbanColumns]);

  const handleCardMove = useCallback(async (cardId: string, newColumn: string) => {
    await advanceZahlung(cardId, newColumn);
  }, [advanceZahlung]);

  // Context greeting
  const contextLine = useMemo(() => {
    const parts: string[] = [];
    if (gemahnte.length > 0) {
      const names = namen(gemahnte.map(g => g.mitgliedName).filter(Boolean));
      parts.push(`${names} ${gemahnte.length === 1 ? 'hat' : 'haben'} offene Mahnungen`);
    }
    if (naechsteVeranstaltungen.length > 0) {
      const next = naechsteVeranstaltungen[0];
      const dateStr = next.fields.datum_uhrzeit
        ? format(parseISO(next.fields.datum_uhrzeit), 'EEEE', { locale: de })
        : '';
      parts.push(`nächste Veranstaltung: ${next.fields.titel ?? ''}${dateStr ? ` am ${dateStr}` : ''}`);
    }
    if (parts.length === 0) {
      return aktiveMitglieder.length > 0
        ? `${aktiveMitglieder.length} aktive Mitglieder, alles im grünen Bereich.`
        : 'Willkommen — leg dein erstes Mitglied an.';
    }
    return parts.join(' · ') + '.';
  }, [gemahnte, naechsteVeranstaltungen, aktiveMitglieder]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Current overlay record lookups
  const overlayItem = overlay.top;
  const overlayZahlung = overlayItem?.type === 'zahlung'
    ? (enrichedBeitraege.find(b => b.record_id === overlayItem.id) ?? null)
    : null;
  const overlayVeranst = overlayItem?.type === 'veranstaltung'
    ? (veranstaltungen.find(v => v.record_id === overlayItem.id) ?? null)
    : null;
  const overlayMitglied = overlayItem?.type === 'mitglied'
    ? (mitglieder.find(m => m.record_id === overlayItem.id) ?? null)
    : null;

  // Hero: gemahnte Zahlungen
  const heroBanner = gemahnte.length > 0 ? (
    <HeroBanner
      tone="warning"
      icon={<IconAlertTriangle size={20} className="shrink-0" />}
      action={{
        label: 'Als bezahlt markieren',
        onClick: () => {
          const first = gemahnte[0];
          if (first) advanceZahlung(first.record_id, 'bezahlt');
        },
      }}
    >
      <b>{gemahnte.length} gemahnte Zahlung{gemahnte.length > 1 ? 'en' : ''}</b> —{' '}
      {namen(gemahnte.map(g => g.mitgliedName).filter(Boolean))} {gemahnte.length === 1 ? 'hat' : 'haben'} eine offene Mahnung.
    </HeroBanner>
  ) : null;

  return (
    <>
      {/* Page header */}
      <div className={`mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${ENTRANCE}`}>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">
            {gruss(clock)}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{contextLine}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setMitgliedDialog({ open: true, record: null })}>
            <IconPlus size={14} className="mr-1 shrink-0" />Mitglied
          </Button>
          <Button size="sm" onClick={() => setZahlungDialog({ open: true, record: null })}>
            <IconPlus size={14} className="mr-1 shrink-0" />Zahlung
          </Button>
        </div>
      </div>

      <DashboardGrid
        hero={heroBanner}
        kpis={
          <StatCardRow>
            <StatCard
              title="Aktive Mitglieder"
              value={aktiveMitglieder.length}
              description={aktiveMitglieder.length > 0 ? `${mitglieder.length} gesamt` : 'Noch keine aktiven Mitglieder'}
              icon={<IconUsers size={18} className="text-muted-foreground" />}
              tone="primary"
            />
            <StatCard
              title="Offen"
              value={offeneZahlungen.length}
              description={offeneZahlungen.length > 0 ? 'Beiträge ausstehend' : 'Alles bezahlt'}
              icon={<IconCash size={18} className="text-muted-foreground" />}
              tone={offeneZahlungen.length > 0 ? 'warning' : 'default'}
              onClick={() => setStatusFilter(f => f === 'offen' ? null : 'offen')}
              active={statusFilter === 'offen'}
            />
            <StatCard
              title="Gemahnt"
              value={gemahnte.length}
              description={gemahnte.length > 0 ? 'Sofort handeln' : 'Keine Mahnungen'}
              icon={<IconAlertCircle size={18} className="text-muted-foreground" />}
              tone={gemahnte.length > 0 ? 'destructive' : 'default'}
              onClick={() => setStatusFilter(f => f === 'gemahnt' ? null : 'gemahnt')}
              active={statusFilter === 'gemahnt'}
            />
            <StatCard
              title="Nächste Veranstaltung"
              value={naechsteVeranstaltungen.length > 0
                ? (naechsteVeranstaltungen[0].fields.datum_uhrzeit
                  ? format(parseISO(naechsteVeranstaltungen[0].fields.datum_uhrzeit), 'dd. MMM', { locale: de })
                  : '—')
                : '—'}
              description={naechsteVeranstaltungen[0]?.fields.titel ?? 'Keine geplant'}
              icon={<IconCalendarEvent size={18} className="text-muted-foreground" />}
              tone="default"
              onClick={() => naechsteVeranstaltungen[0] && overlay.push({ type: 'veranstaltung', id: naechsteVeranstaltungen[0].record_id })}
            />
          </StatCardRow>
        }
        aside={
          <>
            {/* Upcoming events */}
            <div className={ENTRANCE} style={entranceDelay(240)}>
              <WorkList
                title="Nächste Veranstaltungen"
                icon={<IconCalendarEvent size={14} className="shrink-0" />}
                items={naechsteVeranstaltungen.map(v => {
                  const teilnehmerCount = veranstaltungsteilnahmen.filter(
                    t => extractRecordId(t.fields.veranstaltung) === v.record_id,
                  ).length;
                  const maxT = v.fields.max_teilnehmer;
                  return {
                    id: v.record_id,
                    title: v.fields.titel ?? '(Ohne Titel)',
                    secondLine: (
                      <>
                        <span className="text-muted-foreground">
                          {v.fields.datum_uhrzeit
                            ? format(parseISO(v.fields.datum_uhrzeit), 'EEE dd.MM., HH:mm', { locale: de })
                            : '—'}
                        </span>
                        {maxT != null && (
                          <span className={`ml-2 ${teilnehmerCount >= maxT ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            · {teilnehmerCount}/{maxT}
                          </span>
                        )}
                      </>
                    ),
                    action: {
                      label: <><IconPlus size={12} className="inline shrink-0" />&nbsp;Anmelden</>,
                      onClick: () => setVeranstDialog({ open: false, record: null }),
                    },
                  };
                })}
                onItemClick={id => overlay.push({ type: 'veranstaltung', id })}
                empty={{
                  text: 'Keine kommenden Veranstaltungen geplant.',
                  action: { label: 'Veranstaltung anlegen', onClick: () => setVeranstDialog({ open: true, record: null }) },
                }}
              />
            </div>

            {/* Offene Zahlungen this year */}
            <div className={ENTRANCE} style={entranceDelay(300)}>
              <WorkList
                title="Offene Beiträge"
                icon={<IconClock size={14} className="shrink-0" />}
                items={offeneZahlungen.slice(0, 6).map(b => ({
                  id: b.record_id,
                  title: b.mitgliedName || `Mitglied ${b.record_id.slice(-4)}`,
                  secondLine: (
                    <>
                      <span className="font-medium text-warning-foreground text-amber-600">Offen</span>
                      {b.fields.beitragsjahr && (
                        <span className="text-muted-foreground"> · {b.fields.beitragsjahr}</span>
                      )}
                      {b.fields.beitragshoehe != null && (
                        <span className="text-muted-foreground"> · {formatCurrency(b.fields.beitragshoehe)}</span>
                      )}
                    </>
                  ),
                  action: {
                    label: '✓ Bezahlt',
                    onClick: () => advanceZahlung(b.record_id, 'bezahlt'),
                  },
                }))}
                onItemClick={id => overlay.push({ type: 'zahlung', id })}
                empty={{
                  text: 'Alle Beiträge sind bezahlt — super!',
                  action: { label: 'Beitrag erfassen', onClick: () => setZahlungDialog({ open: true, record: null }) },
                }}
              />
            </div>
          </>
        }
        primary={
          <div className={ENTRANCE} style={entranceDelay(360)}>
            <KanbanWidget
              columns={kanbanColumns}
              cards={kanbanCards}
              defaultCollapsed={['storniert']}
              onCardClick={card => overlay.push({ type: 'zahlung', id: card.id })}
              onCardMove={handleCardMove}
              onAddCard={col => setZahlungDialog({ open: true, record: null, defaultStatus: col })}
            />
          </div>
        }
      />

      {/* === OVERLAYS === */}

      {/* Zahlung overlay */}
      <RecordOverlay
        open={overlay.open && overlayItem?.type === 'zahlung'}
        onClose={overlay.close}
        onBack={overlay.canGoBack ? overlay.pop : undefined}
        onEdit={overlayZahlung ? () => setZahlungDialog({ open: true, record: overlayZahlung }) : undefined}
        footer={
          overlayZahlung && lookupKey(overlayZahlung.fields.zahlungsstatus) !== 'bezahlt' ? (
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                if (overlayZahlung) {
                  advanceZahlung(overlayZahlung.record_id, 'bezahlt');
                  overlay.close();
                }
              }}
            >
              <IconCheck size={14} className="mr-1" />Als bezahlt markieren
            </Button>
          ) : undefined
        }
      >
        {overlayZahlung && (
          <>
            <RecordHeader
              title={overlayZahlung.mitgliedName || 'Unbekanntes Mitglied'}
              subtitle={overlayZahlung.fields.beitragsjahr ? `Beitrag ${overlayZahlung.fields.beitragsjahr}` : 'Beitrag'}
              badges={overlayZahlung.fields.zahlungsstatus ? (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  lookupKey(overlayZahlung.fields.zahlungsstatus) === 'bezahlt' ? 'bg-green-100 text-green-700'
                  : lookupKey(overlayZahlung.fields.zahlungsstatus) === 'gemahnt' ? 'bg-amber-100 text-amber-700'
                  : lookupKey(overlayZahlung.fields.zahlungsstatus) === 'storniert' ? 'bg-red-100 text-red-700'
                  : 'bg-muted text-muted-foreground'
                }`}>
                  {overlayZahlung.fields.zahlungsstatus.label}
                </span>
              ) : undefined}
            />
            <RecordKeyFacts
              items={[
                { label: 'Betrag', value: overlayZahlung.fields.beitragshoehe != null ? formatCurrency(overlayZahlung.fields.beitragshoehe) : '—' },
                { label: 'Jahr', value: overlayZahlung.fields.beitragsjahr?.toString() ?? '—' },
                { label: 'Zahlungsart', value: overlayZahlung.fields.zahlungsart?.label ?? '—' },
                { label: 'Zahlungsdatum', value: formatDate(overlayZahlung.fields.zahlungsdatum) },
              ]}
            />
            <RecordSection title="Details">
              <RecordField label="Mitglied" value={overlayZahlung.mitgliedName} />
              <RecordField label="Bemerkungen" value={overlayZahlung.fields.bemerkungen_zahlung} format="longtext" />
            </RecordSection>
            <RecordAttachments appId={APP_IDS.BEITRAEGE_ZAHLUNGEN} recordId={overlayZahlung.record_id} />
          </>
        )}
      </RecordOverlay>

      {/* Veranstaltung overlay */}
      <RecordOverlay
        open={overlay.open && overlayItem?.type === 'veranstaltung'}
        onClose={overlay.close}
        onBack={overlay.canGoBack ? overlay.pop : undefined}
        onEdit={overlayVeranst ? () => setVeranstDialog({ open: true, record: overlayVeranst }) : undefined}
      >
        {overlayVeranst && (
          <>
            <RecordHeader
              title={overlayVeranst.fields.titel ?? 'Veranstaltung'}
              subtitle={overlayVeranst.fields.veranstaltungsort}
              badges={overlayVeranst.fields.veranstaltungsart ? (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                  {overlayVeranst.fields.veranstaltungsart.label}
                </span>
              ) : undefined}
            />
            <RecordKeyFacts
              items={[
                { label: 'Datum & Uhrzeit', value: formatDateTime(overlayVeranst.fields.datum_uhrzeit) },
                { label: 'Anmeldeschluss', value: formatDate(overlayVeranst.fields.anmeldeschluss) },
                {
                  label: 'Teilnehmer',
                  value: (() => {
                    const count = veranstaltungsteilnahmen.filter(
                      t => extractRecordId(t.fields.veranstaltung) === overlayVeranst.record_id,
                    ).length;
                    return overlayVeranst.fields.max_teilnehmer != null
                      ? `${count} / ${overlayVeranst.fields.max_teilnehmer}`
                      : `${count}`;
                  })(),
                },
                { label: 'Verantwortlich', value: overlayVeranst.fields.verantwortlicher ?? '—' },
              ]}
            />
            <RecordSection title="Beschreibung">
              <RecordField label="Beschreibung" value={overlayVeranst.fields.beschreibung} format="longtext" />
              <RecordField label="Bemerkungen" value={overlayVeranst.fields.bemerkungen_veranstaltung} format="longtext" />
            </RecordSection>
            {/* Teilnahmen for this event */}
            <RecordSection title="Angemeldete Mitglieder">
              {enrichedTeilnahmen
                .filter(t => extractRecordId(t.fields.veranstaltung) === overlayVeranst.record_id)
                .map(t => (
                  <RecordField
                    key={t.record_id}
                    label={t.mitgliedName || 'Mitglied'}
                    value={t.fields.anwesenheit ? 'Anwesend ✓' : 'Angemeldet'}
                    format="text"
                  />
                ))}
            </RecordSection>
            <RecordAttachments appId={APP_IDS.VERANSTALTUNGEN} recordId={overlayVeranst.record_id} />
          </>
        )}
      </RecordOverlay>

      {/* Mitglied overlay */}
      <RecordOverlay
        open={overlay.open && overlayItem?.type === 'mitglied'}
        onClose={overlay.close}
        onBack={overlay.canGoBack ? overlay.pop : undefined}
        onEdit={overlayMitglied ? () => setMitgliedDialog({ open: true, record: overlayMitglied }) : undefined}
      >
        {overlayMitglied && (
          <>
            <RecordHeader
              title={[overlayMitglied.fields.vorname, overlayMitglied.fields.nachname].filter(Boolean).join(' ') || 'Mitglied'}
              subtitle={overlayMitglied.fields.email}
              badges={overlayMitglied.fields.mitgliedsstatus ? (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  lookupKey(overlayMitglied.fields.mitgliedsstatus) === 'aktiv' ? 'bg-green-100 text-green-700'
                  : lookupKey(overlayMitglied.fields.mitgliedsstatus) === 'ausgetreten' ? 'bg-red-100 text-red-700'
                  : 'bg-muted text-muted-foreground'
                }`}>
                  {overlayMitglied.fields.mitgliedsstatus.label}
                </span>
              ) : undefined}
            />
            <RecordKeyFacts
              items={[
                { label: 'Mitgliedsnummer', value: overlayMitglied.fields.mitgliedsnummer ?? '—' },
                { label: 'Eintrittsdatum', value: formatDate(overlayMitglied.fields.eintrittsdatum) },
                { label: 'Telefon', value: overlayMitglied.fields.telefon ?? '—' },
                { label: 'Ort', value: overlayMitglied.fields.ort ?? '—' },
              ]}
            />
            <RecordSection title="Kontakt">
              <RecordField label="E-Mail" value={overlayMitglied.fields.email} format="email" />
              <RecordField label="Telefon" value={overlayMitglied.fields.telefon} />
              <RecordField label="Adresse" value={[
                overlayMitglied.fields.strasse,
                overlayMitglied.fields.hausnummer,
                overlayMitglied.fields.plz,
                overlayMitglied.fields.ort,
              ].filter(Boolean).join(' ') || undefined} />
            </RecordSection>
            <RecordAttachments appId={APP_IDS.MITGLIEDER} recordId={overlayMitglied.record_id} />
          </>
        )}
      </RecordOverlay>

      {/* === DIALOGS === */}
      <BeitraegeZahlungenDialog
        open={zahlungDialog.open}
        onClose={() => setZahlungDialog({ open: false, record: null })}
        onSubmit={async fields => {
          if (zahlungDialog.record) {
            await LivingAppsService.updateBeitraegeZahlungenEntry(zahlungDialog.record.record_id, fields);
          } else {
            await LivingAppsService.createBeitraegeZahlungenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={zahlungDialog.record?.fields ?? (zahlungDialog.defaultStatus ? { zahlungsstatus: zahlungDialog.defaultStatus } : undefined)}
        recordId={zahlungDialog.record?.record_id}
        mitgliederList={mitglieder}
        enablePhotoScan={AI_PHOTO_SCAN['BeitraegeZahlungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['BeitraegeZahlungen']}
      />

      <VeranstaltungenDialog
        open={veranstDialog.open}
        onClose={() => setVeranstDialog({ open: false, record: null })}
        onSubmit={async fields => {
          if (veranstDialog.record) {
            await LivingAppsService.updateVeranstaltungenEntry(veranstDialog.record.record_id, fields);
          } else {
            await LivingAppsService.createVeranstaltungenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={veranstDialog.record?.fields}
        recordId={veranstDialog.record?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungen']}
      />

      <MitgliederDialog
        open={mitgliedDialog.open}
        onClose={() => setMitgliedDialog({ open: false, record: null })}
        onSubmit={async fields => {
          if (mitgliedDialog.record) {
            await LivingAppsService.updateMitgliederEntry(mitgliedDialog.record.record_id, fields);
          } else {
            await LivingAppsService.createMitgliederEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={mitgliedDialog.record?.fields}
        recordId={mitgliedDialog.record?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Mitglieder']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Mitglieder']}
      />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte lade die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktiere den Support.</p>}
    </div>
  );
}
