import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Veranstaltungen, Mitglieder, Veranstaltungsteilnahmen } from '@/types/app';
import {
  IconCalendarEvent,
  IconUsers,
  IconUserCheck,
  IconChartBar,
  IconCheck,
  IconX,
  IconArrowRight,
  IconRefresh,
} from '@tabler/icons-react';

const STEPS = [
  { label: 'Veranstaltung' },
  { label: 'Anmeldungen' },
  { label: 'Anwesenheit' },
  { label: 'Abschluss' },
];

function formatEventDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'dd.MM.yyyy HH:mm', { locale: de });
  } catch {
    return dateStr;
  }
}

function formatDateOnly(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'dd.MM.yyyy', { locale: de });
  } catch {
    return dateStr;
  }
}

export default function VeranstaltungDurchfuehrenPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { veranstaltungen, veranstaltungsteilnahmen, mitglieder, loading, error, fetchAll } =
    useDashboardData();

  // Initialize from URL
  const urlStep = parseInt(searchParams.get('step') ?? '1', 10);
  const urlEventId = searchParams.get('veranstaltungId') ?? null;

  const [currentStep, setCurrentStep] = useState<number>(
    urlStep >= 1 && urlStep <= 4 ? urlStep : 1
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(urlEventId);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [updatingAttendance, setUpdatingAttendance] = useState<Set<string>>(new Set());

  // Sync step and eventId to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentStep > 1) {
      params.set('step', String(currentStep));
    } else {
      params.delete('step');
    }
    if (selectedEventId) {
      params.set('veranstaltungId', selectedEventId);
    } else {
      params.delete('veranstaltungId');
    }
    setSearchParams(params, { replace: true });
  }, [currentStep, selectedEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived data
  const selectedEvent = useMemo<Veranstaltungen | undefined>(
    () => veranstaltungen.find(v => v.record_id === selectedEventId),
    [veranstaltungen, selectedEventId]
  );

  // Participations for the selected event
  const eventParticipations = useMemo<Veranstaltungsteilnahmen[]>(
    () =>
      veranstaltungsteilnahmen.filter(p => {
        const id = extractRecordId(p.fields.veranstaltung);
        return id === selectedEventId;
      }),
    [veranstaltungsteilnahmen, selectedEventId]
  );

  // Set of already-registered member IDs
  const registeredMemberIds = useMemo<Set<string>>(
    () =>
      new Set(
        eventParticipations
          .map(p => extractRecordId(p.fields.mitglied))
          .filter((id): id is string => id !== null)
      ),
    [eventParticipations]
  );

  // Members NOT yet registered
  const unregisteredMembers = useMemo<Mitglieder[]>(
    () => mitglieder.filter(m => !registeredMemberIds.has(m.record_id)),
    [mitglieder, registeredMemberIds]
  );

  // Members that ARE registered (with their participation record)
  const registeredParticipations = useMemo(
    () =>
      eventParticipations.map(p => {
        const memberId = extractRecordId(p.fields.mitglied);
        const member = memberId ? mitglieder.find(m => m.record_id === memberId) : undefined;
        return { participation: p, member };
      }),
    [eventParticipations, mitglieder]
  );

  function handleSelectEvent(id: string) {
    setSelectedEventId(id);
    setSelectedMemberIds(new Set());
    setRegisterError(null);
    setCurrentStep(2);
  }

  function handleStepChange(step: number) {
    setCurrentStep(step);
  }

  function toggleMemberSelection(memberId: string) {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }

  async function handleRegister() {
    if (!selectedEventId || selectedMemberIds.size === 0) return;
    setRegistering(true);
    setRegisterError(null);
    const today = new Date().toISOString().split('T')[0];
    try {
      await Promise.all(
        Array.from(selectedMemberIds).map(memberId =>
          LivingAppsService.createVeranstaltungsteilnahmenEntry({
            mitglied: createRecordUrl(APP_IDS.MITGLIEDER, memberId),
            veranstaltung: createRecordUrl(APP_IDS.VERANSTALTUNGEN, selectedEventId),
            anmeldedatum: today,
            anwesenheit: false,
          })
        )
      );
      await fetchAll();
      setSelectedMemberIds(new Set());
    } catch {
      setRegisterError('Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setRegistering(false);
    }
  }

  async function handleToggleAttendance(participationId: string, currentValue: boolean) {
    setUpdatingAttendance(prev => new Set(prev).add(participationId));
    try {
      await LivingAppsService.updateVeranstaltungsteilnahmenEntry(participationId, {
        anwesenheit: !currentValue,
      });
      await fetchAll();
    } finally {
      setUpdatingAttendance(prev => {
        const next = new Set(prev);
        next.delete(participationId);
        return next;
      });
    }
  }

  async function handleMarkAllPresent() {
    const toUpdate = registeredParticipations.filter(
      ({ participation }) => !participation.fields.anwesenheit
    );
    await Promise.all(
      toUpdate.map(({ participation }) =>
        LivingAppsService.updateVeranstaltungsteilnahmenEntry(participation.record_id, {
          anwesenheit: true,
        })
      )
    );
    await fetchAll();
  }

  function handleReset() {
    setSelectedEventId(null);
    setSelectedMemberIds(new Set());
    setRegisterError(null);
    setCurrentStep(1);
  }

  // Summary stats for step 4
  const totalRegistered = registeredParticipations.length;
  const totalPresent = registeredParticipations.filter(
    ({ participation }) => participation.fields.anwesenheit === true
  ).length;
  const totalAbsent = totalRegistered - totalPresent;
  const attendanceRate =
    totalRegistered > 0 ? Math.round((totalPresent / totalRegistered) * 100) : 0;

  const maxTeilnehmer = selectedEvent?.fields.max_teilnehmer ?? null;

  return (
    <IntentWizardShell
      title="Veranstaltung durchführen"
      subtitle="Anmeldungen verwalten und Anwesenheit erfassen"
      steps={STEPS}
      currentStep={currentStep}
      onStepChange={handleStepChange}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ─── Step 1: Veranstaltung wählen ─── */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Wähle eine Veranstaltung, um Anmeldungen und Anwesenheit zu verwalten.
          </p>
          <EntitySelectStep
            items={veranstaltungen.map(v => ({
              id: v.record_id,
              title: v.fields.titel ?? '(kein Titel)',
              subtitle: [
                v.fields.veranstaltungsort,
                v.fields.datum_uhrzeit ? formatEventDate(v.fields.datum_uhrzeit) : undefined,
              ]
                .filter(Boolean)
                .join(' | '),
              status: v.fields.veranstaltungsart
                ? { key: v.fields.veranstaltungsart.key, label: v.fields.veranstaltungsart.label }
                : undefined,
              stats: v.fields.max_teilnehmer
                ? [{ label: 'Max. Teilnehmer', value: v.fields.max_teilnehmer }]
                : [],
              icon: <IconCalendarEvent size={20} className="text-primary" />,
            }))}
            onSelect={handleSelectEvent}
            searchPlaceholder="Veranstaltung suchen..."
            emptyIcon={<IconCalendarEvent size={32} />}
            emptyText="Keine Veranstaltungen gefunden."
          />
        </div>
      )}

      {/* ─── Step 2: Anmeldungen verwalten ─── */}
      {currentStep === 2 && selectedEvent && (
        <div className="space-y-6">
          {/* Event context card */}
          <div className="rounded-xl border bg-card p-4 flex items-start gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <IconCalendarEvent size={20} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">
                {selectedEvent.fields.titel ?? '(kein Titel)'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedEvent.fields.veranstaltungsort} &middot;{' '}
                {formatEventDate(selectedEvent.fields.datum_uhrzeit)}
              </p>
              {selectedEvent.fields.veranstaltungsart && (
                <div className="mt-1">
                  <StatusBadge
                    statusKey={selectedEvent.fields.veranstaltungsart.key}
                    label={selectedEvent.fields.veranstaltungsart.label}
                  />
                </div>
              )}
            </div>
            {/* Teilnehmer-Zähler */}
            <div className="text-right shrink-0">
              <p
                className={`text-lg font-bold ${
                  maxTeilnehmer && totalRegistered >= maxTeilnehmer
                    ? 'text-destructive'
                    : 'text-primary'
                }`}
              >
                {totalRegistered}
                {maxTeilnehmer ? ` / ${maxTeilnehmer}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">angemeldet</p>
            </div>
          </div>

          {/* Progress bar */}
          {maxTeilnehmer && maxTeilnehmer > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Auslastung</span>
                <span>{Math.min(100, Math.round((totalRegistered / maxTeilnehmer) * 100))} %</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    totalRegistered >= maxTeilnehmer ? 'bg-destructive' : 'bg-primary'
                  }`}
                  style={{
                    width: `${Math.min(100, (totalRegistered / maxTeilnehmer) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Already registered */}
          {registeredParticipations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <IconUserCheck size={16} className="text-primary" />
                Bereits angemeldet ({registeredParticipations.length})
              </h3>
              <div className="space-y-1.5">
                {registeredParticipations.map(({ participation, member }) => (
                  <div
                    key={participation.record_id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card overflow-hidden"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                      {member
                        ? `${(member.fields.vorname ?? '?')[0]}${(member.fields.nachname ?? '?')[0]}`
                        : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member
                          ? `${member.fields.vorname ?? ''} ${member.fields.nachname ?? ''}`.trim() ||
                            '(kein Name)'
                          : '(Mitglied nicht gefunden)'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Angemeldet: {formatDateOnly(participation.fields.anmeldedatum)}
                      </p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unregistered members to select */}
          {unregisteredMembers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <IconUsers size={16} className="text-muted-foreground" />
                Mitglieder anmelden
              </h3>
              <p className="text-xs text-muted-foreground">
                Wähle die Mitglieder aus, die du anmelden möchtest.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {unregisteredMembers.map(member => {
                  const isSelected = selectedMemberIds.has(member.record_id);
                  const fullName =
                    `${member.fields.vorname ?? ''} ${member.fields.nachname ?? ''}`.trim() ||
                    '(kein Name)';
                  return (
                    <button
                      key={member.record_id}
                      onClick={() => toggleMemberSelection(member.record_id)}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors overflow-hidden ${
                        isSelected
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card border-border hover:bg-accent'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isSelected ? (
                          <IconCheck size={14} stroke={2.5} />
                        ) : (
                          `${(member.fields.vorname ?? '?')[0]}${(member.fields.nachname ?? '?')[0]}`
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fullName}</p>
                        {member.fields.mitgliedsnummer && (
                          <p className="text-xs text-muted-foreground">
                            Nr. {member.fields.mitgliedsnummer}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {unregisteredMembers.length === 0 && registeredParticipations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <IconUsers size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Keine Mitglieder verfügbar.</p>
            </div>
          )}

          {registerError && (
            <p className="text-sm text-destructive">{registerError}</p>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="gap-2"
            >
              Zurück
            </Button>
            {selectedMemberIds.size > 0 && (
              <Button
                onClick={handleRegister}
                disabled={registering}
                className="gap-2 flex-1"
              >
                {registering ? (
                  <>
                    <IconRefresh size={16} className="animate-spin" />
                    Wird angemeldet...
                  </>
                ) : (
                  <>
                    <IconUserCheck size={16} />
                    {selectedMemberIds.size}{' '}
                    {selectedMemberIds.size === 1 ? 'Mitglied' : 'Mitglieder'} anmelden
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={() => setCurrentStep(3)}
              disabled={registeredParticipations.length === 0}
              className="gap-2"
              variant={selectedMemberIds.size > 0 ? 'outline' : 'default'}
            >
              Weiter zur Anwesenheit
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Anwesenheit erfassen ─── */}
      {currentStep === 3 && selectedEvent && (
        <div className="space-y-6">
          {/* Live counter */}
          <div className="rounded-xl border bg-card p-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {totalPresent}{' '}
                  <span className="text-lg font-normal text-muted-foreground">
                    von {totalRegistered}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Mitglieder anwesend</p>
              </div>
              {totalRegistered > 0 && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">{attendanceRate} %</p>
                  <p className="text-xs text-muted-foreground">Anwesenheitsrate</p>
                </div>
              )}
            </div>
            {totalRegistered > 0 && (
              <div className="mt-3 h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-2 bg-green-500 rounded-full transition-all"
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
            )}
          </div>

          {registeredParticipations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <IconUserCheck size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Noch keine Anmeldungen vorhanden.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setCurrentStep(2)}
              >
                Zurück zu Anmeldungen
              </Button>
            </div>
          ) : (
            <>
              {/* Quick action */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllPresent}
                  disabled={totalPresent === totalRegistered}
                  className="gap-2"
                >
                  <IconCheck size={14} />
                  Alle anwesend
                </Button>
              </div>

              {/* Attendance toggle cards */}
              <div className="space-y-2">
                {registeredParticipations.map(({ participation, member }) => {
                  const isPresent = participation.fields.anwesenheit === true;
                  const isUpdating = updatingAttendance.has(participation.record_id);
                  const fullName = member
                    ? `${member.fields.vorname ?? ''} ${member.fields.nachname ?? ''}`.trim() ||
                      '(kein Name)'
                    : '(Mitglied nicht gefunden)';

                  return (
                    <div
                      key={participation.record_id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors overflow-hidden ${
                        isPresent ? 'bg-green-50 border-green-200' : 'bg-card border-border'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                          isPresent
                            ? 'bg-green-500 text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {member
                          ? `${(member.fields.vorname ?? '?')[0]}${(member.fields.nachname ?? '?')[0]}`
                          : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fullName}</p>
                        {member?.fields.mitgliedsnummer && (
                          <p className="text-xs text-muted-foreground">
                            Nr. {member.fields.mitgliedsnummer}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          handleToggleAttendance(participation.record_id, isPresent)
                        }
                        disabled={isUpdating}
                        className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                          isPresent
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                        aria-label={isPresent ? 'Als abwesend markieren' : 'Als anwesend markieren'}
                      >
                        {isUpdating ? (
                          <IconRefresh size={16} className="animate-spin" />
                        ) : isPresent ? (
                          <IconCheck size={16} stroke={2.5} />
                        ) : (
                          <IconX size={16} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(2)}
              className="gap-2"
            >
              Zurück
            </Button>
            <Button
              onClick={() => setCurrentStep(4)}
              className="gap-2 flex-1"
            >
              Zum Abschluss
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 4: Abschluss ─── */}
      {currentStep === 4 && selectedEvent && (
        <div className="space-y-6">
          {/* Summary card */}
          <div className="rounded-2xl border bg-card p-6 space-y-5 overflow-hidden shadow-lg">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconChartBar size={22} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-lg truncate">
                  {selectedEvent.fields.titel ?? '(kein Titel)'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {formatEventDate(selectedEvent.fields.datum_uhrzeit)}
                  {selectedEvent.fields.veranstaltungsort && (
                    <> &middot; {selectedEvent.fields.veranstaltungsort}</>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl bg-secondary p-4 text-center">
                <p className="text-3xl font-bold text-foreground">{totalRegistered}</p>
                <p className="text-xs text-muted-foreground mt-1">Angemeldet</p>
              </div>
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{totalPresent}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Anwesend ({attendanceRate}&thinsp;%)
                </p>
              </div>
              <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 text-center">
                <p className="text-3xl font-bold text-destructive">{totalAbsent}</p>
                <p className="text-xs text-muted-foreground mt-1">Nicht erschienen</p>
              </div>
            </div>

            {/* Attendance bar */}
            {totalRegistered > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Anwesenheitsrate</span>
                  <span className="font-semibold text-foreground">{attendanceRate} %</span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      attendanceRate >= 80
                        ? 'bg-green-500'
                        : attendanceRate >= 50
                        ? 'bg-yellow-500'
                        : 'bg-destructive'
                    }`}
                    style={{ width: `${attendanceRate}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(3)}
              className="gap-2"
            >
              Zurück zur Anwesenheit
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="gap-2 flex-1"
            >
              <IconCalendarEvent size={16} />
              Neue Veranstaltung bearbeiten
            </Button>
            <a href="#/" className="contents">
              <Button className="gap-2 flex-1">
                Zurück zum Dashboard
                <IconArrowRight size={16} />
              </Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
