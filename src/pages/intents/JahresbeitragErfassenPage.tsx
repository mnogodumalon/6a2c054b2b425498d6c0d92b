import { useState, useEffect, useMemo } from 'react';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { StatusBadge } from '@/components/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Mitglieder, BeitraegeZahlungen } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  IconCheck,
  IconCalendar,
  IconCash,
  IconUsers,
  IconCircleCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { format } from 'date-fns';

// ── Types ────────────────────────────────────────────────────────────────────

interface PaymentRow {
  memberId: string;
  memberName: string;
  mitgliedsnummer: string;
  betrag: number;
  zahlungsart: string;
  zahlungsdatum: string;
  zahlungsstatus: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CURRENT_YEAR = 2026;
const YEARS = Array.from({ length: CURRENT_YEAR - 2020 + 1 }, (_, i) => 2020 + i);

const ZAHLUNGSART_OPTIONS = [
  { key: 'ueberweisung', label: 'Überweisung' },
  { key: 'lastschrift', label: 'Lastschrift' },
  { key: 'bar', label: 'Barzahlung' },
];

const ZAHLUNGSSTATUS_OPTIONS = [
  { key: 'bezahlt', label: 'Bezahlt' },
  { key: 'offen', label: 'Offen' },
  { key: 'gemahnt', label: 'Gemahnt' },
];

const WIZARD_STEPS = [
  { label: 'Jahr & Einstellungen' },
  { label: 'Mitglieder' },
  { label: 'Beiträge erfassen' },
];

function todayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function JahresbeitragErfassenPage() {
  const { mitglieder, beitraegeZahlungen, loading, error, fetchAll } = useDashboardData();

  // Step state
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 state
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [standardBetrag, setStandardBetrag] = useState<number>(60);
  const [selectedZahlungsart, setSelectedZahlungsart] = useState<string>('ueberweisung');

  // Step 2 state
  const [checkedMemberIds, setCheckedMemberIds] = useState<Set<string>>(new Set());

  // Step 3 state
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [saveTotal, setSaveTotal] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [finalTotal, setFinalTotal] = useState(0);
  const [finalCount, setFinalCount] = useState(0);

  // ── Derived data ────────────────────────────────────────────────────────────

  // Members that already have a payment record for the selected year
  const paidMemberIds = useMemo<Set<string>>(() => {
    const ids = new Set<string>();
    beitraegeZahlungen.forEach((b: BeitraegeZahlungen) => {
      if (b.fields.beitragsjahr === selectedYear && b.fields.mitglied) {
        const id = extractRecordId(b.fields.mitglied);
        if (id) ids.add(id);
      }
    });
    return ids;
  }, [beitraegeZahlungen, selectedYear]);

  const unpaidMembers = useMemo<Mitglieder[]>(
    () => mitglieder.filter((m: Mitglieder) => !paidMemberIds.has(m.record_id)),
    [mitglieder, paidMemberIds]
  );

  const paidMembers = useMemo<Mitglieder[]>(
    () => mitglieder.filter((m: Mitglieder) => paidMemberIds.has(m.record_id)),
    [mitglieder, paidMemberIds]
  );

  // Initialize checkboxes when moving to step 2
  useEffect(() => {
    if (currentStep === 2) {
      setCheckedMemberIds(new Set(unpaidMembers.map((m) => m.record_id)));
    }
  }, [currentStep, unpaidMembers]);

  // Build payment rows when moving to step 3
  useEffect(() => {
    if (currentStep === 3) {
      const today = todayString();
      const rows: PaymentRow[] = Array.from(checkedMemberIds).map((id) => {
        const m = mitglieder.find((x: Mitglieder) => x.record_id === id);
        const name = m
          ? `${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.trim()
          : id;
        return {
          memberId: id,
          memberName: name,
          mitgliedsnummer: m?.fields.mitgliedsnummer ?? '–',
          betrag: standardBetrag,
          zahlungsart: selectedZahlungsart,
          zahlungsdatum: today,
          zahlungsstatus: 'bezahlt',
        };
      });
      setPaymentRows(rows);
    }
  }, [currentStep, checkedMemberIds, mitglieder, standardBetrag, selectedZahlungsart]);

  const runningTotal = useMemo(
    () => paymentRows.reduce((sum, r) => sum + (r.betrag || 0), 0),
    [paymentRows]
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleToggleMember(id: string) {
    setCheckedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    setCheckedMemberIds(new Set(unpaidMembers.map((m) => m.record_id)));
  }

  function handleDeselectAll() {
    setCheckedMemberIds(new Set());
  }

  function updateRow(index: number, field: keyof PaymentRow, value: string | number) {
    setPaymentRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSavedCount(0);
    setSaveTotal(paymentRows.length);
    setSaveProgress(0);

    let successCount = 0;
    let totalAmount = 0;
    const errors: string[] = [];

    for (let i = 0; i < paymentRows.length; i++) {
      const row = paymentRows[i];
      try {
        await LivingAppsService.createBeitraegeZahlungenEntry({
          mitglied: createRecordUrl(APP_IDS.MITGLIEDER, row.memberId),
          beitragsjahr: selectedYear,
          beitragshoehe: row.betrag,
          zahlungsart: row.zahlungsart,
          zahlungsdatum: row.zahlungsdatum,
          zahlungsstatus: row.zahlungsstatus,
        });
        successCount++;
        totalAmount += row.betrag;
        setSavedCount(successCount);
        setSaveProgress(Math.round(((i + 1) / paymentRows.length) * 100));
      } catch (err) {
        errors.push(
          `${row.memberName}: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
        );
      }
    }

    await fetchAll();

    setFinalCount(successCount);
    setFinalTotal(totalAmount);
    setSaving(false);

    if (errors.length > 0) {
      setSaveError(
        `${errors.length} Einträge konnten nicht gespeichert werden:\n${errors.join('\n')}`
      );
    } else {
      setDone(true);
    }
  }

  function handleReset() {
    setCurrentStep(1);
    setSelectedYear(CURRENT_YEAR);
    setStandardBetrag(60);
    setSelectedZahlungsart('ueberweisung');
    setCheckedMemberIds(new Set());
    setPaymentRows([]);
    setSaving(false);
    setSaveProgress(0);
    setSavedCount(0);
    setSaveTotal(0);
    setSaveError(null);
    setDone(false);
    setFinalTotal(0);
    setFinalCount(0);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <IntentWizardShell
      title="Jahresbeiträge erfassen"
      subtitle="Erfasse Beitragszahlungen effizient für alle Mitglieder"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Jahr & Einstellungen ───────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="space-y-8">
          {/* Year selector */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <IconCalendar size={18} className="text-primary shrink-0" />
              <h2 className="font-semibold text-foreground">Beitragsjahr</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {YEARS.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    selectedYear === year
                      ? 'bg-primary text-primary-foreground border-primary shadow-md'
                      : 'bg-card text-foreground border-muted hover:border-primary/50'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Standard fee */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <IconCash size={18} className="text-primary shrink-0" />
              <h2 className="font-semibold text-foreground">Standard-Beitragshöhe</h2>
            </div>
            <div className="flex items-center gap-3 max-w-xs">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={standardBetrag}
                onChange={(e) => setStandardBetrag(parseFloat(e.target.value) || 0)}
                className="text-lg font-semibold"
              />
              <span className="text-muted-foreground font-medium text-lg">€</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Dieser Betrag wird für alle Mitglieder vorausgefüllt und kann in Schritt 3
              individuell angepasst werden.
            </p>
          </div>

          {/* Zahlungsart tiles */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <IconCash size={18} className="text-primary shrink-0" />
              <h2 className="font-semibold text-foreground">Standard-Zahlungsart</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {ZAHLUNGSART_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSelectedZahlungsart(opt.key)}
                  className={`px-5 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                    selectedZahlungsart === opt.key
                      ? 'bg-primary text-primary-foreground border-primary shadow-md'
                      : 'bg-card text-foreground border-muted hover:border-primary/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary card */}
          <div className="bg-secondary rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <IconCalendar size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Ausgewählt</p>
              <p className="font-semibold text-foreground">
                Jahr {selectedYear} · {standardBetrag.toFixed(2)} € ·{' '}
                {ZAHLUNGSART_OPTIONS.find((o) => o.key === selectedZahlungsart)?.label}
              </p>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => setCurrentStep(2)}
          >
            Weiter zu Mitgliedern
          </Button>
        </div>
      )}

      {/* ── Step 2: Mitglieder auswählen ──────────────────────────────────── */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* Counter bar */}
          <div className="bg-secondary rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconUsers size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ausgewählt für {selectedYear}</p>
                <p className="font-semibold text-foreground">
                  {checkedMemberIds.size} von {unpaidMembers.length} Mitglieder ausgewählt
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                Alle auswählen
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                Alle abwählen
              </Button>
            </div>
          </div>

          {/* Uncaptured members */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                {unpaidMembers.length}
              </span>
              Noch nicht erfasst
            </h3>

            {unpaidMembers.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                <IconCircleCheck size={32} className="text-green-600 mx-auto mb-2" />
                <p className="font-semibold text-green-800">Alle Mitglieder erfasst!</p>
                <p className="text-sm text-green-700 mt-1">
                  Für das Jahr {selectedYear} liegen für alle Mitglieder bereits Beitragseinträge vor.
                </p>
              </div>
            ) : (
              <div className="space-y-2 overflow-hidden">
                {unpaidMembers.map((m) => {
                  const checked = checkedMemberIds.has(m.record_id);
                  const fullName =
                    `${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.trim() || '(kein Name)';
                  return (
                    <div
                      key={m.record_id}
                      onClick={() => handleToggleMember(m.record_id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        checked
                          ? 'border-primary bg-primary/5'
                          : 'border-muted bg-card hover:border-primary/30'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => handleToggleMember(m.record_id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          Nr. {m.fields.mitgliedsnummer ?? '–'}
                        </p>
                      </div>
                      {m.fields.mitgliedsstatus && (
                        <StatusBadge
                          statusKey={m.fields.mitgliedsstatus.key}
                          label={m.fields.mitgliedsstatus.label}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Already captured members */}
          {paidMembers.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-muted-foreground flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                  {paidMembers.length}
                </span>
                Bereits erfasst
              </h3>
              <div className="space-y-2 opacity-60">
                {paidMembers.map((m) => {
                  const fullName =
                    `${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.trim() || '(kein Name)';
                  // Find the payment record for this member and year
                  const payment = beitraegeZahlungen.find(
                    (b: BeitraegeZahlungen) =>
                      b.fields.beitragsjahr === selectedYear &&
                      extractRecordId(b.fields.mitglied) === m.record_id
                  );
                  return (
                    <div
                      key={m.record_id}
                      className="flex items-center gap-3 p-3 rounded-xl border-2 border-muted bg-muted/30"
                    >
                      <div className="w-5 h-5 rounded flex items-center justify-center bg-green-100">
                        <IconCheck size={12} className="text-green-600" stroke={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          Nr. {m.fields.mitgliedsnummer ?? '–'}
                        </p>
                      </div>
                      {payment?.fields.zahlungsstatus && (
                        <StatusBadge
                          statusKey={payment.fields.zahlungsstatus.key}
                          label={payment.fields.zahlungsstatus.label}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 flex-wrap pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              Zurück
            </Button>
            <Button
              size="lg"
              disabled={checkedMemberIds.size === 0}
              onClick={() => setCurrentStep(3)}
            >
              Weiter zu Beiträge erfassen ({checkedMemberIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Zahlungen erfassen ────────────────────────────────────── */}
      {currentStep === 3 && !done && (
        <div className="space-y-6">
          {/* Live total */}
          <div className="bg-secondary rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">Gesamtsumme</p>
              <p className="text-2xl font-bold text-foreground">
                {runningTotal.toLocaleString('de-DE', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Mitglieder</p>
              <p className="text-xl font-semibold text-foreground">{paymentRows.length}</p>
            </div>
          </div>

          {/* Save progress */}
          {saving && (
            <div className="space-y-2 bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-sm font-medium text-blue-800">
                Speichere {savedCount} von {saveTotal} Einträgen...
              </p>
              <Progress value={saveProgress} className="h-2" />
            </div>
          )}

          {/* Error */}
          {saveError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex gap-3">
              <IconAlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive text-sm">Fehler beim Speichern</p>
                <pre className="text-xs text-destructive/80 mt-1 whitespace-pre-wrap">
                  {saveError}
                </pre>
              </div>
            </div>
          )}

          {/* Payment table */}
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                    Mitglied
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                    Betrag (€)
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                    Zahlungsart
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                    Zahldatum
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((row, i) => (
                  <tr
                    key={row.memberId}
                    className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground truncate max-w-[160px]">
                        {row.memberName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Nr. {row.mitgliedsnummer}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={row.betrag}
                        onChange={(e) =>
                          updateRow(i, 'betrag', parseFloat(e.target.value) || 0)
                        }
                        className="w-24 text-sm"
                        disabled={saving}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.zahlungsart}
                        onChange={(e) => updateRow(i, 'zahlungsart', e.target.value)}
                        disabled={saving}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                      >
                        {ZAHLUNGSART_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="date"
                        value={row.zahlungsdatum}
                        onChange={(e) => updateRow(i, 'zahlungsdatum', e.target.value)}
                        className="w-36 text-sm"
                        disabled={saving}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.zahlungsstatus}
                        onChange={(e) => updateRow(i, 'zahlungsstatus', e.target.value)}
                        disabled={saving}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                      >
                        {ZAHLUNGSSTATUS_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 border-t-2 border-border">
                  <td className="px-4 py-3 font-semibold text-foreground">Gesamt</td>
                  <td className="px-4 py-3 font-bold text-foreground">
                    {runningTotal.toLocaleString('de-DE', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Navigation */}
          <div className="flex gap-3 flex-wrap pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(2)} disabled={saving}>
              Zurück
            </Button>
            <Button
              size="lg"
              onClick={handleSave}
              disabled={saving || paymentRows.length === 0}
            >
              {saving
                ? `Speichere ${savedCount} von ${saveTotal}...`
                : `Beiträge speichern (${paymentRows.length})`}
            </Button>
          </div>
        </div>
      )}

      {/* ── Done / Success ────────────────────────────────────────────────── */}
      {currentStep === 3 && done && (
        <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
            <IconCircleCheck size={36} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              Beiträge erfolgreich gespeichert!
            </h2>
            <p className="text-muted-foreground">
              {finalCount} Beiträge für das Jahr {selectedYear} wurden erfasst.
            </p>
            <p className="text-2xl font-bold text-foreground mt-3">
              Gesamtbetrag:{' '}
              {finalTotal.toLocaleString('de-DE', {
                style: 'currency',
                currency: 'EUR',
              })}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <Button size="lg" onClick={handleReset}>
              Neues Jahr erfassen
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="#/">Zurück zum Dashboard</a>
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
