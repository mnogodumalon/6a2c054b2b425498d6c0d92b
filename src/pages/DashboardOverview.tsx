import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBeitraegeZahlungen, enrichVeranstaltungsteilnahmen } from '@/lib/enrich';
import type { EnrichedBeitraegeZahlungen } from '@/types/enriched';
import type { Mitglieder, Veranstaltungen } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconUsers, IconCalendar,
  IconCurrencyEuro, IconSearch, IconMapPin, IconClock,
  IconUserCheck, IconUserX, IconChevronRight,
} from '@tabler/icons-react';
import { MitgliederDialog } from '@/components/dialogs/MitgliederDialog';
import { VeranstaltungenDialog } from '@/components/dialogs/VeranstaltungenDialog';
import { BeitraegeZahlungenDialog } from '@/components/dialogs/BeitraegeZahlungenDialog';
import { VeranstaltungsteilnahmenDialog } from '@/components/dialogs/VeranstaltungsteilnahmenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';

const APPGROUP_ID = '6a2c054b2b425498d6c0d92b';
const REPAIR_ENDPOINT = '/claude/build/repair';

// ─── Status-Farben ───────────────────────────────────────────────────────────
function statusVariant(key?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (key === 'aktiv') return 'default';
  if (key === 'passiv') return 'secondary';
  if (key === 'ausgetreten') return 'destructive';
  return 'outline';
}

function zahlungsstatusVariant(key?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (key === 'bezahlt') return 'default';
  if (key === 'offen') return 'secondary';
  if (key === 'gemahnt') return 'destructive';
  return 'outline';
}

// ─── Haupt-Dashboard ─────────────────────────────────────────────────────────
export default function DashboardOverview() {
  const {
    mitglieder, beitraegeZahlungen, veranstaltungen, veranstaltungsteilnahmen,
    mitgliederMap, veranstaltungenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedBeitraegeZahlungen = enrichBeitraegeZahlungen(beitraegeZahlungen, { mitgliederMap });
  const enrichedVeranstaltungsteilnahmen = enrichVeranstaltungsteilnahmen(veranstaltungsteilnahmen, { mitgliederMap, veranstaltungenMap });

  // ── Tabs ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'mitglieder' | 'veranstaltungen' | 'beitraege'>('mitglieder');

  // ── Suche ───────────────────────────────────────────────────────────────────
  const [mitgliederSearch, setMitgliederSearch] = useState('');
  const [veranstaltungenSearch, setVeranstaltungenSearch] = useState('');
  const [beitraegeSearch, setBeitraegeSearch] = useState('');

  // ── Mitglieder-Dialog ───────────────────────────────────────────────────────
  const [mitgliederDialogOpen, setMitgliederDialogOpen] = useState(false);
  const [editingMitglied, setEditingMitglied] = useState<Mitglieder | null>(null);
  const [deleteMitglied, setDeleteMitglied] = useState<Mitglieder | null>(null);

  // ── Veranstaltungen-Dialog ──────────────────────────────────────────────────
  const [veranstaltungDialogOpen, setVeranstaltungDialogOpen] = useState(false);
  const [editingVeranstaltung, setEditingVeranstaltung] = useState<Veranstaltungen | null>(null);
  const [deleteVeranstaltung, setDeleteVeranstaltung] = useState<Veranstaltungen | null>(null);
  const [selectedVeranstaltung, setSelectedVeranstaltung] = useState<Veranstaltungen | null>(null);

  // ── Beiträge-Dialog ─────────────────────────────────────────────────────────
  const [beitragDialogOpen, setBeitragDialogOpen] = useState(false);
  const [editingBeitrag, setEditingBeitrag] = useState<EnrichedBeitraegeZahlungen | null>(null);
  const [deleteBeitrag, setDeleteBeitrag] = useState<EnrichedBeitraegeZahlungen | null>(null);

  // ── Teilnahmen-Dialog ───────────────────────────────────────────────────────
  const [teilnahmeDialogOpen, setTeilnahmeDialogOpen] = useState(false);
  const [prefillVeranstaltungId, setPrefillVeranstaltungId] = useState<string | undefined>(undefined);

  // ── KPI ─────────────────────────────────────────────────────────────────────
  const kpiData = useMemo(() => {
    const aktiv = mitglieder.filter(m => m.fields.mitgliedsstatus?.key === 'aktiv').length;
    const today = new Date().toISOString().slice(0, 10);
    const kommend = veranstaltungen.filter(v => (v.fields.datum_uhrzeit ?? '') >= today).length;
    const offen = beitraegeZahlungen.filter(b => b.fields.zahlungsstatus?.key === 'offen').length;
    const einnahmen = beitraegeZahlungen
      .filter(b => b.fields.zahlungsstatus?.key === 'bezahlt')
      .reduce((s, b) => s + (b.fields.beitragshoehe ?? 0), 0);
    return { aktiv, gesamt: mitglieder.length, kommend, offen, einnahmen };
  }, [mitglieder, veranstaltungen, beitraegeZahlungen]);

  // ── Gefilterte Listen ────────────────────────────────────────────────────────
  const filteredMitglieder = useMemo(() => {
    const q = mitgliederSearch.toLowerCase();
    if (!q) return mitglieder;
    return mitglieder.filter(m =>
      `${m.fields.vorname} ${m.fields.nachname}`.toLowerCase().includes(q) ||
      (m.fields.email ?? '').toLowerCase().includes(q) ||
      (m.fields.mitgliedsnummer ?? '').toLowerCase().includes(q)
    );
  }, [mitglieder, mitgliederSearch]);

  const filteredVeranstaltungen = useMemo(() => {
    const q = veranstaltungenSearch.toLowerCase();
    const sorted = [...veranstaltungen].sort((a, b) =>
      (b.fields.datum_uhrzeit ?? '').localeCompare(a.fields.datum_uhrzeit ?? '')
    );
    if (!q) return sorted;
    return sorted.filter(v =>
      (v.fields.titel ?? '').toLowerCase().includes(q) ||
      (v.fields.veranstaltungsort ?? '').toLowerCase().includes(q)
    );
  }, [veranstaltungen, veranstaltungenSearch]);

  const filteredBeitraege = useMemo(() => {
    const q = beitraegeSearch.toLowerCase();
    if (!q) return enrichedBeitraegeZahlungen;
    return enrichedBeitraegeZahlungen.filter(b =>
      b.mitgliedName.toLowerCase().includes(q) ||
      String(b.fields.beitragsjahr ?? '').includes(q)
    );
  }, [enrichedBeitraegeZahlungen, beitraegeSearch]);

  // ── Teilnahmen für gewählte Veranstaltung ────────────────────────────────────
  const teilnahmenFuerEvent = useMemo(() => {
    if (!selectedVeranstaltung) return [];
    return enrichedVeranstaltungsteilnahmen.filter(t => {
      const id = extractRecordId(t.fields.veranstaltung);
      return id === selectedVeranstaltung.record_id;
    });
  }, [selectedVeranstaltung, enrichedVeranstaltungsteilnahmen]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const tabs = [
    { id: 'mitglieder' as const, label: 'Mitglieder', count: mitglieder.length },
    { id: 'veranstaltungen' as const, label: 'Veranstaltungen', count: veranstaltungen.length },
    { id: 'beitraege' as const, label: 'Beiträge & Zahlungen', count: beitraegeZahlungen.length },
  ];

  return (
    <div className="space-y-6">
      {/* ── Workflow-Navigation ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href="#/intents/veranstaltungsanmeldung" className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 overflow-hidden border-l-4 border-l-primary no-underline">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <IconUsers size={20} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">Mitglieder anmelden</p>
            <p className="text-xs text-muted-foreground line-clamp-2">Mehrere Mitglieder auf einmal zu einer Veranstaltung anmelden</p>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground shrink-0" />
        </a>
        <a href="#/intents/jahresbeitrag-erfassen" className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 overflow-hidden border-l-4 border-l-primary no-underline">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <IconCurrencyEuro size={20} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">Jahresbeiträge erfassen</p>
            <p className="text-xs text-muted-foreground line-clamp-2">Beitragszahlungen für alle Mitglieder eines Jahres schnell erfassen</p>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground shrink-0" />
        </a>
      </div>

      {/* ── KPI-Leiste ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Aktive Mitglieder"
          value={String(kpiData.aktiv)}
          description={`von ${kpiData.gesamt} gesamt`}
          icon={<IconUsers size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Kommende Events"
          value={String(kpiData.kommend)}
          description="Veranstaltungen"
          icon={<IconCalendar size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Offene Beiträge"
          value={String(kpiData.offen)}
          description="Zahlungen ausstehend"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Einnahmen (bezahlt)"
          value={formatCurrency(kpiData.einnahmen)}
          description="Beiträge eingegangen"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* ── Tab-Navigation ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-background border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ── Mitglieder-Tab ─────────────────────────────────────────────── */}
      {activeTab === 'mitglieder' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suche nach Name, E-Mail, Mitgliedsnummer..."
                className="pl-9"
                value={mitgliederSearch}
                onChange={e => setMitgliederSearch(e.target.value)}
              />
            </div>
            <Button onClick={() => { setEditingMitglied(null); setMitgliederDialogOpen(true); }} size="sm">
              <IconPlus size={16} className="mr-1 shrink-0" />
              <span>Neues Mitglied</span>
            </Button>
          </div>

          {filteredMitglieder.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <IconUsers size={48} stroke={1.5} />
              <p className="text-sm">Keine Mitglieder gefunden</p>
              <Button variant="outline" size="sm" onClick={() => { setEditingMitglied(null); setMitgliederDialogOpen(true); }}>
                <IconPlus size={14} className="mr-1" />Jetzt hinzufügen
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMitglieder.map(m => (
                <div key={m.record_id} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 overflow-hidden">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{m.fields.vorname} {m.fields.nachname}</p>
                      {m.fields.mitgliedsnummer && (
                        <p className="text-xs text-muted-foreground">#{m.fields.mitgliedsnummer}</p>
                      )}
                    </div>
                    <Badge variant={statusVariant(m.fields.mitgliedsstatus?.key)} className="shrink-0 text-xs">
                      {m.fields.mitgliedsstatus?.label ?? 'Unbekannt'}
                    </Badge>
                  </div>
                  {m.fields.email && (
                    <p className="text-sm text-muted-foreground truncate">{m.fields.email}</p>
                  )}
                  {m.fields.eintrittsdatum && (
                    <p className="text-xs text-muted-foreground">Eintritt: {formatDate(m.fields.eintrittsdatum)}</p>
                  )}
                  <div className="flex gap-2 flex-wrap mt-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => { setEditingMitglied(m); setMitgliederDialogOpen(true); }}
                    >
                      <IconPencil size={14} className="mr-1 shrink-0" />Bearbeiten
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteMitglied(m)}
                    >
                      <IconTrash size={14} className="shrink-0" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Veranstaltungen-Tab ────────────────────────────────────────── */}
      {activeTab === 'veranstaltungen' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Linke Spalte: Veranstaltungsliste */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Titel oder Ort suchen..."
                  className="pl-9"
                  value={veranstaltungenSearch}
                  onChange={e => setVeranstaltungenSearch(e.target.value)}
                />
              </div>
              <Button onClick={() => { setEditingVeranstaltung(null); setVeranstaltungDialogOpen(true); }} size="sm">
                <IconPlus size={16} className="mr-1 shrink-0" />
                <span>Neue Veranstaltung</span>
              </Button>
            </div>

            {filteredVeranstaltungen.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <IconCalendar size={48} stroke={1.5} />
                <p className="text-sm">Keine Veranstaltungen gefunden</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredVeranstaltungen.map(v => {
                  const isSelected = selectedVeranstaltung?.record_id === v.record_id;
                  const today = new Date().toISOString().slice(0, 10);
                  const isPast = (v.fields.datum_uhrzeit ?? '') < today;
                  const teilnahmenCount = veranstaltungsteilnahmen.filter(t => {
                    const id = extractRecordId(t.fields.veranstaltung);
                    return id === v.record_id;
                  }).length;
                  return (
                    <div
                      key={v.record_id}
                      onClick={() => setSelectedVeranstaltung(isSelected ? null : v)}
                      className={`bg-card border rounded-2xl p-4 cursor-pointer transition-all overflow-hidden ${
                        isSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/50'
                      } ${isPast ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate">{v.fields.titel ?? '(Kein Titel)'}</p>
                            {v.fields.veranstaltungsart && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {v.fields.veranstaltungsart.label}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                            {v.fields.datum_uhrzeit && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <IconClock size={12} className="shrink-0" />
                                {formatDate(v.fields.datum_uhrzeit)}
                              </span>
                            )}
                            {v.fields.veranstaltungsort && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <IconMapPin size={12} className="shrink-0" />
                                <span className="truncate max-w-[150px]">{v.fields.veranstaltungsort}</span>
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <IconUsers size={12} className="shrink-0" />
                              {teilnahmenCount}{v.fields.max_teilnehmer ? `/${v.fields.max_teilnehmer}` : ''} Teiln.
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={e => { e.stopPropagation(); setEditingVeranstaltung(v); setVeranstaltungDialogOpen(true); }}
                          >
                            <IconPencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={e => { e.stopPropagation(); setDeleteVeranstaltung(v); }}
                          >
                            <IconTrash size={14} />
                          </Button>
                          <IconChevronRight size={16} className={`text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rechte Spalte: Teilnehmerliste */}
          <div>
            {selectedVeranstaltung ? (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4 sticky top-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{selectedVeranstaltung.fields.titel}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Teilnehmerliste</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setPrefillVeranstaltungId(selectedVeranstaltung.record_id);
                      setTeilnahmeDialogOpen(true);
                    }}
                  >
                    <IconPlus size={14} className="mr-1 shrink-0" />Anmelden
                  </Button>
                </div>

                {teilnahmenFuerEvent.length === 0 ? (
                  <div className="flex flex-col items-center py-10 gap-2 text-muted-foreground">
                    <IconUsers size={36} stroke={1.5} />
                    <p className="text-sm">Noch keine Anmeldungen</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {teilnahmenFuerEvent.map(t => (
                      <div key={t.record_id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/50 transition-colors">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          t.fields.anwesenheit ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'
                        }`}>
                          {t.fields.anwesenheit
                            ? <IconUserCheck size={14} />
                            : <IconUserX size={14} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{t.mitgliedName || '(Unbekannt)'}</p>
                          {t.fields.anmeldedatum && (
                            <p className="text-xs text-muted-foreground">angemeldet {formatDate(t.fields.anmeldedatum)}</p>
                          )}
                        </div>
                        {t.fields.anwesenheit && (
                          <Badge variant="default" className="text-xs shrink-0">Anwesend</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 text-muted-foreground border-2 border-dashed border-border rounded-2xl p-8">
                <IconCalendar size={40} stroke={1.5} />
                <p className="text-sm text-center">Veranstaltung auswählen,<br />um Teilnehmer zu sehen</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Beiträge & Zahlungen-Tab ────────────────────────────────────── */}
      {activeTab === 'beitraege' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Name oder Beitragsjahr suchen..."
                className="pl-9"
                value={beitraegeSearch}
                onChange={e => setBeitraegeSearch(e.target.value)}
              />
            </div>
            <Button onClick={() => { setEditingBeitrag(null); setBeitragDialogOpen(true); }} size="sm">
              <IconPlus size={16} className="mr-1 shrink-0" />
              <span>Neuer Eintrag</span>
            </Button>
          </div>

          {filteredBeitraege.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <IconCurrencyEuro size={48} stroke={1.5} />
              <p className="text-sm">Keine Beiträge gefunden</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mitglied</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jahr</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Betrag</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Zahlungsart</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Datum</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBeitraege.map((b, idx) => (
                    <tr key={b.record_id} className={`border-b border-border last:border-0 hover:bg-accent/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}>
                      <td className="px-4 py-3 font-medium">{b.mitgliedName || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.fields.beitragsjahr ?? '—'}</td>
                      <td className="px-4 py-3 font-medium">{b.fields.beitragshoehe != null ? formatCurrency(b.fields.beitragshoehe) : '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.fields.zahlungsart?.label ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={zahlungsstatusVariant(b.fields.zahlungsstatus?.key)} className="text-xs">
                          {b.fields.zahlungsstatus?.label ?? 'Unbekannt'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(b.fields.zahlungsdatum)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setEditingBeitrag(b); setBeitragDialogOpen(true); }}
                          >
                            <IconPencil size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteBeitrag(b)}
                          >
                            <IconTrash size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Dialoge ─────────────────────────────────────────────────────── */}
      <MitgliederDialog
        open={mitgliederDialogOpen}
        onClose={() => { setMitgliederDialogOpen(false); setEditingMitglied(null); }}
        onSubmit={async (fields) => {
          if (editingMitglied) {
            await LivingAppsService.updateMitgliederEntry(editingMitglied.record_id, fields);
          } else {
            await LivingAppsService.createMitgliederEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingMitglied?.fields}
        recordId={editingMitglied?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Mitglieder']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Mitglieder']}
      />

      <VeranstaltungenDialog
        open={veranstaltungDialogOpen}
        onClose={() => { setVeranstaltungDialogOpen(false); setEditingVeranstaltung(null); }}
        onSubmit={async (fields) => {
          if (editingVeranstaltung) {
            await LivingAppsService.updateVeranstaltungenEntry(editingVeranstaltung.record_id, fields);
          } else {
            await LivingAppsService.createVeranstaltungenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingVeranstaltung?.fields}
        recordId={editingVeranstaltung?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungen']}
      />

      <BeitraegeZahlungenDialog
        open={beitragDialogOpen}
        onClose={() => { setBeitragDialogOpen(false); setEditingBeitrag(null); }}
        onSubmit={async (fields) => {
          if (editingBeitrag) {
            await LivingAppsService.updateBeitraegeZahlungenEntry(editingBeitrag.record_id, fields);
          } else {
            await LivingAppsService.createBeitraegeZahlungenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingBeitrag?.fields}
        recordId={editingBeitrag?.record_id}
        mitgliederList={mitglieder}
        enablePhotoScan={AI_PHOTO_SCAN['BeitraegeZahlungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['BeitraegeZahlungen']}
      />

      <VeranstaltungsteilnahmenDialog
        open={teilnahmeDialogOpen}
        onClose={() => { setTeilnahmeDialogOpen(false); setPrefillVeranstaltungId(undefined); }}
        onSubmit={async (fields) => {
          await LivingAppsService.createVeranstaltungsteilnahmenEntry(fields);
          fetchAll();
        }}
        defaultValues={prefillVeranstaltungId ? {
          veranstaltung: createRecordUrl(APP_IDS.VERANSTALTUNGEN, prefillVeranstaltungId),
        } : undefined}
        mitgliederList={mitglieder}
        veranstaltungenList={veranstaltungen}
        enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungsteilnahmen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungsteilnahmen']}
      />

      {/* ── Delete Confirms ──────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteMitglied}
        title="Mitglied löschen"
        description={`Soll ${deleteMitglied?.fields.vorname} ${deleteMitglied?.fields.nachname} wirklich gelöscht werden?`}
        onConfirm={async () => {
          if (!deleteMitglied) return;
          await LivingAppsService.deleteMitgliederEntry(deleteMitglied.record_id);
          setDeleteMitglied(null);
          fetchAll();
        }}
        onClose={() => setDeleteMitglied(null)}
      />
      <ConfirmDialog
        open={!!deleteVeranstaltung}
        title="Veranstaltung löschen"
        description={`Soll "${deleteVeranstaltung?.fields.titel}" wirklich gelöscht werden?`}
        onConfirm={async () => {
          if (!deleteVeranstaltung) return;
          await LivingAppsService.deleteVeranstaltungenEntry(deleteVeranstaltung.record_id);
          setDeleteVeranstaltung(null);
          if (selectedVeranstaltung?.record_id === deleteVeranstaltung.record_id) setSelectedVeranstaltung(null);
          fetchAll();
        }}
        onClose={() => setDeleteVeranstaltung(null)}
      />
      <ConfirmDialog
        open={!!deleteBeitrag}
        title="Eintrag löschen"
        description="Soll dieser Beitrag/diese Zahlung wirklich gelöscht werden?"
        onConfirm={async () => {
          if (!deleteBeitrag) return;
          await LivingAppsService.deleteBeitraegeZahlungenEntry(deleteBeitrag.record_id);
          setDeleteBeitrag(null);
          fetchAll();
        }}
        onClose={() => setDeleteBeitrag(null)}
      />
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="flex gap-1 border-b border-border pb-0">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-32 rounded-t-lg" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
    </div>
  );
}

// ─── Error ───────────────────────────────────────────────────────────────────
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
      if (!resp.ok || !resp.body) { setRepairing(false); setRepairFailed(true); return; }
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
          if (content.startsWith('[STATUS]')) setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          if (content.startsWith('[DONE]')) { setRepairDone(true); setRepairing(false); }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) setRepairFailed(true);
        }
      }
    } catch { setRepairing(false); setRepairFailed(true); }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
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
        <h3 className="font-semibold mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">{repairing ? repairStatus : error.message}</p>
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
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen.</p>}
    </div>
  );
}
