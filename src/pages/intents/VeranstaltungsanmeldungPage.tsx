import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Veranstaltungen, Mitglieder, Veranstaltungsteilnahmen } from '@/types/app';
import {
  IconCalendar,
  IconMapPin,
  IconUsers,
  IconSearch,
  IconCheck,
  IconUserCheck,
  IconArrowRight,
  IconArrowLeft,
  IconLoader2,
  IconCircleCheck,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Veranstaltung' },
  { label: 'Mitglieder' },
  { label: 'Bestätigen' },
];

function formatEventDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'dd.MM.yyyy HH:mm');
  } catch {
    return dateStr;
  }
}

function formatDateOnly(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'dd.MM.yyyy');
  } catch {
    return dateStr;
  }
}

function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function VeranstaltungsanmeldungPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { veranstaltungen, mitglieder, veranstaltungsteilnahmen, loading, error, fetchAll } =
    useDashboardData();

  // Step state — initialised from URL
  const initialStep = (() => {
    const s = parseInt(searchParams.get('step') ?? '', 10);
    return s >= 1 && s <= 3 ? s : 1;
  })();
  const [step, setStep] = useState(initialStep);

  // Selections
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    searchParams.get('veranstaltungId') ?? null,
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitTotal, setSubmitTotal] = useState(0);
  const [submitDone, setSubmitDone] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  // Sync step to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (step > 1) {
      params.set('step', String(step));
    } else {
      params.delete('step');
    }
    if (selectedEventId) {
      params.set('veranstaltungId', selectedEventId);
    } else {
      params.delete('veranstaltungId');
    }
    setSearchParams(params, { replace: true });
  }, [step, selectedEventId, searchParams, setSearchParams]);

  // Auto-select event from URL param and jump to step 2
  useEffect(() => {
    const urlEventId = searchParams.get('veranstaltungId');
    if (urlEventId && !selectedEventId && veranstaltungen.length > 0) {
      const found = veranstaltungen.find((v) => v.record_id === urlEventId);
      if (found) {
        setSelectedEventId(urlEventId);
        if (step === 1) setStep(2);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veranstaltungen]);

  // Derived: selected event object
  const selectedEvent = useMemo(
    () => veranstaltungen.find((v) => v.record_id === selectedEventId) ?? null,
    [veranstaltungen, selectedEventId],
  );

  // Derived: already-registered member IDs for the selected event
  const alreadyRegisteredMemberIds = useMemo<Set<string>>(() => {
    if (!selectedEventId) return new Set();
    const ids = new Set<string>();
    for (const t of veranstaltungsteilnahmen) {
      const evId = extractRecordId(t.fields.veranstaltung);
      const memId = extractRecordId(t.fields.mitglied);
      if (evId === selectedEventId && memId) {
        ids.add(memId);
      }
    }
    return ids;
  }, [veranstaltungsteilnahmen, selectedEventId]);

  // Derived: filtered members for step 2 search
  const filteredMitglieder = useMemo<Mitglieder[]>(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return mitglieder;
    return mitglieder.filter((m) => {
      const name = `${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.toLowerCase();
      const nr = (m.fields.mitgliedsnummer ?? '').toLowerCase();
      return name.includes(q) || nr.includes(q);
    });
  }, [mitglieder, memberSearch]);

  // Derived: selected members that are NEW (not yet registered)
  const newMemberIds = useMemo<string[]>(() => {
    return Array.from(selectedMemberIds).filter((id) => !alreadyRegisteredMemberIds.has(id));
  }, [selectedMemberIds, alreadyRegisteredMemberIds]);

  // Handlers
  const handleSelectEvent = useCallback(
    (id: string) => {
      setSelectedEventId(id);
      setSelectedMemberIds(new Set());
      setStep(2);
    },
    [],
  );

  const toggleMember = useCallback((id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedEventId || newMemberIds.length === 0) return;
    setSubmitting(true);
    setSubmitProgress(0);
    setSubmitTotal(newMemberIds.length);
    setSubmitCount(0);

    const today = getTodayString();
    let created = 0;

    for (let i = 0; i < newMemberIds.length; i++) {
      const memberId = newMemberIds[i];
      try {
        await LivingAppsService.createVeranstaltungsteilnahmenEntry({
          mitglied: createRecordUrl(APP_IDS.MITGLIEDER, memberId),
          veranstaltung: createRecordUrl(APP_IDS.VERANSTALTUNGEN, selectedEventId),
          anmeldedatum: today,
          anwesenheit: false,
        });
        created++;
      } catch {
        // skip individual failures silently; partial success is fine
      }
      setSubmitProgress(i + 1);
    }

    await fetchAll();
    setSubmitCount(created);
    setSubmitting(false);
    setSubmitDone(true);
  }, [selectedEventId, newMemberIds, fetchAll]);

  const handleReset = useCallback(() => {
    setSelectedEventId(null);
    setSelectedMemberIds(new Set());
    setMemberSearch('');
    setSubmitDone(false);
    setSubmitProgress(0);
    setSubmitTotal(0);
    setSubmitCount(0);
    setStep(1);
  }, []);

  // ---- RENDER ----

  // Event summary card (reused in step 2 + 3 header)
  function EventSummaryBanner({ event }: { event: Veranstaltungen }) {
    return (
      <div className="flex flex-wrap gap-3 items-start p-4 rounded-xl border bg-card mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <IconCalendar size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{event.fields.titel ?? '—'}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            {event.fields.datum_uhrzeit && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <IconCalendar size={12} />
                {formatEventDate(event.fields.datum_uhrzeit)}
              </span>
            )}
            {event.fields.veranstaltungsort && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <IconMapPin size={12} />
                {event.fields.veranstaltungsort}
              </span>
            )}
            {event.fields.max_teilnehmer !== undefined && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <IconUsers size={12} />
                Max. {event.fields.max_teilnehmer} Teilnehmer
              </span>
            )}
          </div>
        </div>
        {event.fields.veranstaltungsart && (
          <StatusBadge
            statusKey={event.fields.veranstaltungsart.key}
            label={event.fields.veranstaltungsart.label}
          />
        )}
      </div>
    );
  }

  return (
    <IntentWizardShell
      title="Mitglieder anmelden"
      subtitle="Melde Mitglieder schnell und einfach zu einer Veranstaltung an"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ──────────────────────────────────────────
          STEP 1 — Veranstaltung auswählen
      ────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold mb-1">Welche Veranstaltung?</h2>
            <p className="text-sm text-muted-foreground">
              Wähle die Veranstaltung aus, zu der du Mitglieder anmelden möchtest.
            </p>
          </div>
          <EntitySelectStep
            items={veranstaltungen.map((v) => ({
              id: v.record_id,
              title: v.fields.titel ?? '(ohne Titel)',
              subtitle: [
                v.fields.datum_uhrzeit ? formatEventDate(v.fields.datum_uhrzeit) : null,
                v.fields.veranstaltungsort ?? null,
              ]
                .filter(Boolean)
                .join(' · '),
              status: v.fields.veranstaltungsart
                ? { key: v.fields.veranstaltungsart.key, label: v.fields.veranstaltungsart.label }
                : undefined,
              stats: [
                {
                  label: 'Max. Teilnehmer',
                  value: v.fields.max_teilnehmer !== undefined ? String(v.fields.max_teilnehmer) : '—',
                },
                {
                  label: 'Anmeldeschluss',
                  value: v.fields.anmeldeschluss ? formatDateOnly(v.fields.anmeldeschluss) : '—',
                },
              ],
              icon: <IconCalendar size={20} className="text-primary" />,
            }))}
            onSelect={handleSelectEvent}
            searchPlaceholder="Veranstaltung suchen..."
            emptyIcon={<IconCalendar size={32} />}
            emptyText="Keine Veranstaltungen gefunden."
          />
        </div>
      )}

      {/* ──────────────────────────────────────────
          STEP 2 — Mitglieder auswählen
      ────────────────────────────────────────── */}
      {step === 2 && selectedEvent && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold mb-1">Welche Mitglieder?</h2>
            <p className="text-sm text-muted-foreground">
              Wähle die Mitglieder aus, die du anmelden möchtest. Bereits angemeldete Mitglieder
              sind markiert.
            </p>
          </div>

          <EventSummaryBanner event={selectedEvent} />

          {/* Search + counter row */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <IconSearch
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Mitglied suchen (Name, Mitgliedsnummer)..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="shrink-0 text-sm font-medium text-muted-foreground whitespace-nowrap">
              {selectedMemberIds.size > 0 ? (
                <span className="text-primary font-semibold">
                  {selectedMemberIds.size} ausgewählt
                </span>
              ) : (
                '0 ausgewählt'
              )}
            </div>
          </div>

          {/* Member list */}
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {filteredMitglieder.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Keine Mitglieder gefunden.
              </div>
            ) : (
              filteredMitglieder.map((m) => {
                const isSelected = selectedMemberIds.has(m.record_id);
                const isRegistered = alreadyRegisteredMemberIds.has(m.record_id);
                const fullName =
                  [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ') || '(unbekannt)';

                return (
                  <button
                    key={m.record_id}
                    onClick={() => toggleMember(m.record_id)}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:bg-accent hover:border-primary/30'
                    }`}
                  >
                    {/* Checkbox indicator */}
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'border-muted-foreground/40 bg-background'
                      }`}
                    >
                      {isSelected && <IconCheck size={12} stroke={3} className="text-primary-foreground" />}
                    </div>

                    {/* Member icon */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {(m.fields.vorname?.[0] ?? '') + (m.fields.nachname?.[0] ?? '')}
                    </div>

                    {/* Name + info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{fullName}</span>
                        {m.fields.mitgliedsstatus && (
                          <StatusBadge
                            statusKey={m.fields.mitgliedsstatus.key}
                            label={m.fields.mitgliedsstatus.label}
                          />
                        )}
                        {isRegistered && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                            <IconUserCheck size={11} />
                            Bereits angemeldet
                          </span>
                        )}
                      </div>
                      {m.fields.mitgliedsnummer && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Nr. {m.fields.mitgliedsnummer}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center pt-2 border-t gap-3">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="gap-2"
            >
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={selectedMemberIds.size === 0}
              className="gap-2"
            >
              Weiter
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────
          STEP 3 — Bestätigen & Anmelden
      ────────────────────────────────────────── */}
      {step === 3 && selectedEvent && !submitDone && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold mb-1">Anmeldung bestätigen</h2>
            <p className="text-sm text-muted-foreground">
              Überprüfe deine Auswahl und starte die Anmeldung.
            </p>
          </div>

          <EventSummaryBanner event={selectedEvent} />

          {/* Summary numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl border bg-card text-center">
              <div className="text-2xl font-bold text-foreground">{selectedMemberIds.size}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Ausgewählt</div>
            </div>
            <div className="p-3 rounded-xl border bg-card text-center">
              <div className="text-2xl font-bold text-primary">{newMemberIds.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Neu anzumelden</div>
            </div>
            <div className="p-3 rounded-xl border bg-card text-center">
              <div className="text-2xl font-bold text-muted-foreground">
                {selectedMemberIds.size - newMemberIds.length}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Bereits registriert</div>
            </div>
          </div>

          {/* Member list for confirmation */}
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Ausgewählte Mitglieder
            </p>
            {Array.from(selectedMemberIds).map((id) => {
              const member = mitglieder.find((m) => m.record_id === id);
              if (!member) return null;
              const isAlready = alreadyRegisteredMemberIds.has(id);
              const fullName =
                [member.fields.vorname, member.fields.nachname].filter(Boolean).join(' ') ||
                '(unbekannt)';
              return (
                <div
                  key={id}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    isAlready ? 'opacity-50 bg-muted/40' : 'bg-card'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                    {(member.fields.vorname?.[0] ?? '') + (member.fields.nachname?.[0] ?? '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium truncate ${isAlready ? 'text-muted-foreground' : ''}`}>
                        {fullName}
                      </span>
                      {isAlready ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                          Bereits registriert
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 shrink-0">
                          Wird angemeldet
                        </span>
                      )}
                    </div>
                    {member.fields.mitgliedsnummer && (
                      <p className="text-xs text-muted-foreground">Nr. {member.fields.mitgliedsnummer}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Anmeldedatum info */}
          <div className="flex items-center gap-2 p-3 rounded-xl border bg-muted/30 text-sm text-muted-foreground">
            <IconCalendar size={16} className="shrink-0" />
            Anmeldedatum: <span className="font-medium text-foreground">{format(new Date(), 'dd.MM.yyyy')}</span>
          </div>

          {/* Progress bar during submission */}
          {submitting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <IconLoader2 size={16} className="animate-spin" />
                  Melde {submitProgress} von {submitTotal} Mitgliedern an...
                </span>
                <span>{Math.round((submitProgress / submitTotal) * 100)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(submitProgress / submitTotal) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center pt-2 border-t gap-3">
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              disabled={submitting}
              className="gap-2"
            >
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || newMemberIds.length === 0}
              className="gap-2"
            >
              {submitting ? (
                <>
                  <IconLoader2 size={16} className="animate-spin" />
                  Wird angemeldet...
                </>
              ) : (
                <>
                  <IconCheck size={16} />
                  Jetzt anmelden ({newMemberIds.length})
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────
          SUCCESS STATE
      ────────────────────────────────────────── */}
      {step === 3 && submitDone && (
        <div className="flex flex-col items-center justify-center py-12 gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <IconCircleCheck size={36} className="text-emerald-600" stroke={1.5} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Anmeldung erfolgreich!</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              {submitCount === 1
                ? `1 Mitglied wurde erfolgreich zu "${selectedEvent?.fields.titel ?? 'der Veranstaltung'}" angemeldet.`
                : `${submitCount} Mitglieder wurden erfolgreich zu "${selectedEvent?.fields.titel ?? 'der Veranstaltung'}" angemeldet.`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Neue Anmeldung
            </Button>
            <a href="#/" className="flex-1">
              <Button className="w-full">Zurück zum Dashboard</Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
