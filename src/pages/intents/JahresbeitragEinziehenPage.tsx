import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { BudgetTracker } from '@/components/BudgetTracker';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Mitglieder, BeitraegeZahlungen } from '@/types/app';
import {
  IconCheck,
  IconCash,
  IconRefresh,
  IconAlertCircle,
  IconUsers,
  IconCircleCheck,
  IconClock,
} from '@tabler/icons-react';
import { format } from 'date-fns';

const CURRENT_YEAR = new Date().getFullYear();
const ZAHLUNGSART_OPTIONS = LOOKUP_OPTIONS['beitraege_zahlungen']?.['zahlungsart'] ?? [];
const ZAHLUNGSSTATUS_OPTIONS = LOOKUP_OPTIONS['beitraege_zahlungen']?.['zahlungsstatus'] ?? [];
const BEZAHLT_KEY = ZAHLUNGSSTATUS_OPTIONS.find(o => o.key === 'bezahlt')?.key ?? 'bezahlt';

interface InlinePaymentState {
  zahlungsart: string;
  zahlungsdatum: string;
  submitting: boolean;
  error: string | null;
}

export default function JahresbeitragEinziehenPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Step state (must be before any early returns) ---
  const initialStep = Math.min(
    Math.max(parseInt(searchParams.get('step') ?? '1', 10), 1),
    3
  );
  const [currentStep, setCurrentStep] = useState(initialStep);

  // --- Step 1 form state ---
  const initialYear = parseInt(searchParams.get('beitragsjahr') ?? String(CURRENT_YEAR), 10);
  const [selectedYear, setSelectedYear] = useState<number>(
    isNaN(initialYear) ? CURRENT_YEAR : initialYear
  );
  const [beitragshoehe, setBeitragshoehe] = useState<string>('48.00');
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // --- Step 2 inline payment state per member ---
  const [paymentStates, setPaymentStates] = useState<Record<string, InlinePaymentState>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // --- Data ---
  const { mitglieder, beitraegeZahlungen, loading, error, fetchAll } = useDashboardData();

  // Sync step to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('step', String(currentStep));
    params.set('beitragsjahr', String(selectedYear));
    setSearchParams(params, { replace: true });
  }, [currentStep, selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Derived data ---
  const aktiveMitglieder = useMemo<Mitglieder[]>(() => {
    const aktiv = mitglieder.filter(m => m.fields.mitgliedsstatus?.key === 'aktiv');
    return aktiv.length > 0 ? aktiv : mitglieder;
  }, [mitglieder]);

  const zahlungenForYear = useMemo<BeitraegeZahlungen[]>(() => {
    return beitraegeZahlungen.filter(z => z.fields.beitragsjahr === selectedYear);
  }, [beitraegeZahlungen, selectedYear]);

  // Map: mitglied record_id -> zahlung record (for selected year)
  const zahlungByMitglied = useMemo<Map<string, BeitraegeZahlungen>>(() => {
    const map = new Map<string, BeitraegeZahlungen>();
    for (const z of zahlungenForYear) {
      const url = z.fields.mitglied;
      if (!url) continue;
      const match = url.match(/([a-f0-9]{24})$/i);
      if (match) map.set(match[1], z);
    }
    return map;
  }, [zahlungenForYear]);

  const beitragshoeheParsed = useMemo(() => {
    const v = parseFloat(beitragshoehe);
    return isNaN(v) || v <= 0 ? 0 : v;
  }, [beitragshoehe]);

  const paidCount = useMemo(() => {
    return aktiveMitglieder.filter(m => zahlungByMitglied.has(m.record_id)).length;
  }, [aktiveMitglieder, zahlungByMitglied]);

  const totalTarget = aktiveMitglieder.length * beitragshoeheParsed;
  const amountCollected = paidCount * beitragshoeheParsed;

  const filteredMitglieder = useMemo<Mitglieder[]>(() => {
    if (!searchQuery.trim()) return aktiveMitglieder;
    const q = searchQuery.toLowerCase();
    return aktiveMitglieder.filter(m => {
      const name = `${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.toLowerCase();
      const nr = (m.fields.mitgliedsnummer ?? '').toLowerCase();
      return name.includes(q) || nr.includes(q);
    });
  }, [aktiveMitglieder, searchQuery]);

  // --- Helpers ---
  const getPaymentState = (memberId: string): InlinePaymentState => {
    return paymentStates[memberId] ?? {
      zahlungsart: ZAHLUNGSART_OPTIONS[0]?.key ?? '',
      zahlungsdatum: format(new Date(), 'yyyy-MM-dd'),
      submitting: false,
      error: null,
    };
  };

  const updatePaymentState = (memberId: string, patch: Partial<InlinePaymentState>) => {
    setPaymentStates(prev => ({
      ...prev,
      [memberId]: { ...getPaymentState(memberId), ...patch },
    }));
  };

  const handleRecordPayment = async (member: Mitglieder) => {
    const ps = getPaymentState(member.record_id);
    if (!ps.zahlungsart) {
      updatePaymentState(member.record_id, { error: 'Bitte Zahlungsart wählen.' });
      return;
    }
    if (!ps.zahlungsdatum) {
      updatePaymentState(member.record_id, { error: 'Bitte Zahlungsdatum eingeben.' });
      return;
    }
    updatePaymentState(member.record_id, { submitting: true, error: null });
    try {
      await LivingAppsService.createBeitraegeZahlungenEntry({
        mitglied: createRecordUrl(APP_IDS.MITGLIEDER, member.record_id),
        beitragsjahr: selectedYear,
        beitragshoehe: beitragshoeheParsed,
        zahlungsart: ps.zahlungsart,
        zahlungsdatum: ps.zahlungsdatum,
        zahlungsstatus: BEZAHLT_KEY,
      });
      await fetchAll();
    } catch (err) {
      updatePaymentState(member.record_id, {
        submitting: false,
        error: err instanceof Error ? err.message : 'Fehler beim Speichern.',
      });
    }
  };

  const handleStep1Weiter = () => {
    if (beitragshoeheParsed <= 0) {
      setStep1Error('Bitte einen gültigen Betrag (> 0 €) eingeben.');
      return;
    }
    setStep1Error(null);
    setCurrentStep(2);
  };

  const handleReset = () => {
    setSelectedYear(CURRENT_YEAR);
    setBeitragshoehe('48.00');
    setPaymentStates({});
    setSearchQuery('');
    setStep1Error(null);
    setCurrentStep(1);
  };

  const formatEuro = (v: number) =>
    v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  const YEAR_OPTIONS = [
    CURRENT_YEAR - 2,
    CURRENT_YEAR - 1,
    CURRENT_YEAR,
    CURRENT_YEAR + 1,
    CURRENT_YEAR + 2,
  ];

  // --- Render ---
  return (
    <IntentWizardShell
      title="Jahresbeitrag einziehen"
      subtitle="Mitgliedsbeiträge für ein Beitragsjahr erfassen und verwalten"
      steps={[
        { label: 'Beitragsjahr' },
        { label: 'Zahlungen erfassen' },
        { label: 'Abschluss' },
      ]}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ───────────────────────────── STEP 1 ───────────────────────────── */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Beitragsjahr &amp; Betrag wählen</h2>
              <p className="text-sm text-muted-foreground">
                Wähle das Beitragsjahr und lege die Beitragshöhe fest.
              </p>
            </div>

            {/* Year selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Beitragsjahr</label>
              <div className="flex flex-wrap gap-2">
                {YEAR_OPTIONS.map(y => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setSelectedYear(y)}
                    className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                      selectedYear === y
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:bg-secondary'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Beitragshoehe */}
            <div className="space-y-2">
              <label htmlFor="beitragshoehe" className="text-sm font-medium">
                Beitragshöhe (€)
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  €
                </span>
                <Input
                  id="beitragshoehe"
                  type="number"
                  min="0"
                  step="0.01"
                  value={beitragshoehe}
                  onChange={e => setBeitragshoehe(e.target.value)}
                  className="pl-7"
                  placeholder="48.00"
                />
              </div>
              {step1Error && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <IconAlertCircle size={14} />
                  {step1Error}
                </p>
              )}
            </div>

            {/* Summary preview */}
            {beitragshoeheParsed > 0 && (
              <div className="rounded-xl bg-secondary/60 p-4 flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Jahr</span>
                  <div className="font-semibold text-base mt-0.5">{selectedYear}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Betrag</span>
                  <div className="font-semibold text-base mt-0.5">{formatEuro(beitragshoeheParsed)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Aktive Mitglieder</span>
                  <div className="font-semibold text-base mt-0.5">{aktiveMitglieder.length}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Beitragspotenzial</span>
                  <div className="font-semibold text-base mt-0.5 text-primary">
                    {formatEuro(totalTarget)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleStep1Weiter} size="lg" className="min-w-[140px]">
              Weiter
            </Button>
          </div>
        </div>
      )}

      {/* ───────────────────────────── STEP 2 ───────────────────────────── */}
      {currentStep === 2 && (
        <div className="space-y-4">
          {/* Header info */}
          <div className="rounded-2xl border bg-card p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Jahr:</span>
              <span className="font-semibold">{selectedYear}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Beitragshöhe:</span>
              <span className="font-semibold">{formatEuro(beitragshoeheParsed)}</span>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="ml-auto text-xs text-muted-foreground underline underline-offset-2"
            >
              Ändern
            </button>
          </div>

          {/* Budget tracker */}
          <BudgetTracker
            budget={totalTarget}
            booked={amountCollected}
            label="Gesammelt"
          />

          {/* Live counter */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm">
              <IconUsers size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Gesamt:</span>
              <span className="font-semibold">{aktiveMitglieder.length} Mitglieder</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 px-4 py-2 text-sm">
              <IconCircleCheck size={16} className="text-green-600" />
              <span className="font-semibold text-green-700 dark:text-green-400">
                {paidCount} bezahlt
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 px-4 py-2 text-sm">
              <IconClock size={16} className="text-amber-600" />
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                {aktiveMitglieder.length - paidCount} ausstehend
              </span>
            </div>
          </div>

          {/* Search */}
          <Input
            placeholder="Mitglied suchen (Name oder Mitgliedsnummer)…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full"
          />

          {/* Member list */}
          <div className="space-y-3">
            {filteredMitglieder.length === 0 && (
              <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground text-sm">
                Keine Mitglieder gefunden.
              </div>
            )}
            {filteredMitglieder.map(member => {
              const zahlung = zahlungByMitglied.get(member.record_id);
              const paid = !!zahlung;
              const name = [member.fields.vorname, member.fields.nachname]
                .filter(Boolean)
                .join(' ') || '(Kein Name)';
              const ps = getPaymentState(member.record_id);

              return (
                <div
                  key={member.record_id}
                  className={`rounded-2xl border bg-card overflow-hidden transition-colors ${
                    paid ? 'border-green-200 dark:border-green-800' : 'border-border'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      {/* Member info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold truncate">{name}</span>
                          {member.fields.mitgliedsnummer && (
                            <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                              #{member.fields.mitgliedsnummer}
                            </span>
                          )}
                          {member.fields.mitgliedsstatus && (
                            <StatusBadge
                              statusKey={member.fields.mitgliedsstatus.key}
                              label={member.fields.mitgliedsstatus.label}
                            />
                          )}
                        </div>
                        {member.fields.email && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {member.fields.email}
                          </p>
                        )}
                      </div>

                      {/* Paid status badge */}
                      {paid && (
                        <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl px-3 py-1.5 text-sm font-medium shrink-0">
                          <IconCheck size={14} stroke={2.5} />
                          Bezahlt
                        </div>
                      )}
                    </div>

                    {/* Payment details if paid */}
                    {paid && zahlung && (
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {zahlung.fields.zahlungsdatum && (
                          <span>
                            Datum:{' '}
                            <span className="font-medium text-foreground">
                              {zahlung.fields.zahlungsdatum}
                            </span>
                          </span>
                        )}
                        {zahlung.fields.zahlungsart && (
                          <span>
                            Zahlungsart:{' '}
                            <span className="font-medium text-foreground">
                              {zahlung.fields.zahlungsart.label}
                            </span>
                          </span>
                        )}
                        {zahlung.fields.beitragshoehe != null && (
                          <span>
                            Betrag:{' '}
                            <span className="font-medium text-foreground">
                              {formatEuro(zahlung.fields.beitragshoehe)}
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Inline payment form if not paid */}
                    {!paid && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        <div className="flex flex-wrap gap-3">
                          {/* Zahlungsart */}
                          <div className="space-y-1 min-w-[160px] flex-1">
                            <label className="text-xs font-medium text-muted-foreground">
                              Zahlungsart
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {ZAHLUNGSART_OPTIONS.map(opt => (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={() =>
                                    updatePaymentState(member.record_id, {
                                      zahlungsart: opt.key,
                                    })
                                  }
                                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                    ps.zahlungsart === opt.key
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-card text-foreground border-border hover:bg-secondary'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Zahlungsdatum */}
                          <div className="space-y-1 min-w-[160px]">
                            <label className="text-xs font-medium text-muted-foreground">
                              Zahlungsdatum
                            </label>
                            <Input
                              type="date"
                              value={ps.zahlungsdatum}
                              onChange={e =>
                                updatePaymentState(member.record_id, {
                                  zahlungsdatum: e.target.value,
                                })
                              }
                              className="text-sm h-9"
                            />
                          </div>
                        </div>

                        {ps.error && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <IconAlertCircle size={12} />
                            {ps.error}
                          </p>
                        )}

                        <Button
                          onClick={() => handleRecordPayment(member)}
                          disabled={ps.submitting}
                          size="sm"
                          className="w-full sm:w-auto"
                        >
                          {ps.submitting ? (
                            <>
                              <IconRefresh size={14} className="mr-1.5 animate-spin" />
                              Speichern…
                            </>
                          ) : (
                            <>
                              <IconCash size={14} className="mr-1.5" />
                              Bezahlt erfassen
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              Zurück
            </Button>
            <Button onClick={() => setCurrentStep(3)}>
              Zum Abschluss
            </Button>
          </div>
        </div>
      )}

      {/* ───────────────────────────── STEP 3 ───────────────────────────── */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">
                Abschluss — Beitragsjahr {selectedYear}
              </h2>
              <p className="text-sm text-muted-foreground">
                Übersicht der erfassten Zahlungen für {selectedYear}.
              </p>
            </div>

            {/* Budget summary */}
            <BudgetTracker
              budget={totalTarget}
              booked={amountCollected}
              label="Gesammelt"
            />

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-secondary/50 p-3 text-center">
                <div className="text-2xl font-bold">{aktiveMitglieder.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Aktive Mitglieder</div>
              </div>
              <div className="rounded-xl border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 p-3 text-center">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {paidCount}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Bezahlt</div>
                {aktiveMitglieder.length > 0 && (
                  <div className="text-xs font-semibold text-green-600 mt-0.5">
                    {Math.round((paidCount / aktiveMitglieder.length) * 100)} %
                  </div>
                )}
              </div>
              <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 p-3 text-center">
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {aktiveMitglieder.length - paidCount}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Ausstehend</div>
              </div>
              <div className="rounded-xl border bg-secondary/50 p-3 text-center">
                <div className="text-lg font-bold">{formatEuro(amountCollected)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Gesammelt</div>
              </div>
            </div>

            {/* Remaining */}
            {totalTarget - amountCollected > 0 && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 flex items-center gap-3">
                <IconClock size={18} className="text-amber-600 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    {formatEuro(totalTarget - amountCollected)}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    noch nicht eingezogen
                    {aktiveMitglieder.length - paidCount > 0
                      ? ` (${aktiveMitglieder.length - paidCount} Mitglieder)`
                      : ''}
                  </span>
                </div>
              </div>
            )}

            {paidCount === aktiveMitglieder.length && aktiveMitglieder.length > 0 && (
              <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 flex items-center gap-3">
                <IconCircleCheck size={18} className="text-green-600 shrink-0" />
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                  Alle Beiträge für {selectedYear} vollständig eingezogen!
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              Zurück zu Zahlungen
            </Button>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleReset}>
                Neues Beitragsjahr
              </Button>
              <a href="#/">
                <Button>Zum Dashboard</Button>
              </a>
            </div>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
