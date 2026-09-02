import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { useStepForm, useJourneySubmit, todayIso } from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Field } from '@/components/blocks/Field';
import { DatePicker } from '@/components/DatePicker';
import { Input } from '@/components/ui/input';
import { tx } from '@/i18n';

const SLUG = 'mitglied-registrieren';

const STEPS = [
  { label: tx('Persönliche Daten'),  key: 'persoenlich' },
  { label: tx('Kontakt & Adresse'),  key: 'kontakt' },
  { label: tx('Mitgliedschaft'),     key: 'mitgliedschaft' },
  { label: tx('Zahlungsdaten'),      key: 'zahlung' },
  { label: tx('Prüfen & Absenden'),  key: 'summary' },
];

export default function MitgliedRegistrieren() {
  const [cfg, setCfg]     = useState<PublicPagesConfig | null>(null);
  const [page, setPage]   = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [step, setStep]   = useState(1);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        if (!c?.pages[SLUG]) setUnavailable(true);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        else setUnavailable(true);
      })
      .finally(() => setLoading(false));
  }, []);

  // ALL hooks before any early return
  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  const f = useStepForm('mitglieder', {
    fields: [
      'vorname', 'nachname', 'geburtsdatum',
      'email', 'telefon',
      'strasse', 'hausnummer', 'plz', 'ort',
      'iban',
    ],
    required: {
      vorname: true,
      nachname: true,
      email: true,
      telefon: false,
      geburtsdatum: false,
      strasse: false,
      hausnummer: false,
      plz: false,
      ort: false,
      iban: false,
    },
    steps: {
      vorname: 1, nachname: 1, geburtsdatum: 1,
      email: 2, telefon: 2,
      strasse: 2, hausnummer: 2, plz: 2, ort: 2,
      iban: 4,
    },
    initial: { eintrittsdatum: todayIso() },
  });

  const submit = useJourneySubmit(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    port!,
    [{ key: 'mitglied', entity: 'mitglieder', form: f, primary: true }],
    { draftKey: SLUG },
  );

  const restart = () => {
    f.reset();
    submit.reset?.();
    setStep(1);
  };

  const handleFirstInteraction = () => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep) prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  };

  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page || !port) return <PublicShell unavailable />;

  return (
    <PublicShell
      title={page.title}
      description={page.description}
    >
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[f]}
        draftKey={SLUG}
        subtitle={tx('Füll das Formular aus — es dauert ca. 2 Minuten.')}
      >
        {/* Schritt 1: Persönliche Daten */}
        {step === 1 && (
          <div className="space-y-4" onFocus={handleFirstInteraction}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field form={f} name="vorname">
                <Input {...f.field('vorname')} autoComplete="given-name" />
              </Field>
              <Field form={f} name="nachname">
                <Input {...f.field('nachname')} autoComplete="family-name" />
              </Field>
            </div>
            <Field form={f} name="geburtsdatum" hint={tx('Format: TT.MM.JJJJ')}>
              <DatePicker {...f.date('geburtsdatum')} mode="date" />
            </Field>
            <StepNav
              onNext={() => f.validate(['vorname', 'nachname'])}
              nextStepLabel={tx('Kontakt & Adresse')}
            />
          </div>
        )}

        {/* Schritt 2: Kontakt & Adresse */}
        {step === 2 && (
          <div className="space-y-4">
            <Field form={f} name="email">
              <Input {...f.field('email')} autoComplete="email" />
            </Field>
            <Field form={f} name="telefon">
              <Input {...f.field('telefon')} autoComplete="tel" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field form={f} name="strasse" className="col-span-2">
                <Input {...f.field('strasse')} autoComplete="street-address" />
              </Field>
              <Field form={f} name="hausnummer">
                <Input {...f.field('hausnummer')} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field form={f} name="plz">
                <Input {...f.field('plz')} autoComplete="postal-code" />
              </Field>
              <Field form={f} name="ort">
                <Input {...f.field('ort')} autoComplete="address-level2" />
              </Field>
            </div>
            <StepNav
              onNext={() => f.validate(['email'])}
              nextStepLabel={tx('Mitgliedschaft')}
            />
          </div>
        )}

        {/* Schritt 3: Mitgliedschaft — Info-Schritt, keine Eingabe vom Besucher */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {tx('Nach dem Absenden erhältst du eine Bestätigung. Das Team vergib dir deine Mitgliedsnummer und legt deinen Beitrag fest.')}
            </p>
            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm space-y-1">
              <div className="font-medium">{tx('Dein Eintrittsdatum')}</div>
              <div className="text-muted-foreground">{tx('wird automatisch auf heute gesetzt.')}</div>
            </div>
            <StepNav
              nextStepLabel={tx('Zahlungsdaten')}
            />
          </div>
        )}

        {/* Schritt 4: Zahlungsdaten */}
        {step === 4 && (
          <div className="space-y-4">
            <Field
              form={f}
              name="iban"
              hint={tx('Optional — für den Mitgliedsbeitrag per Lastschrift. Format: DE89 3704 0044 0532 0130 00')}
            >
              <Input {...f.field('iban')} autoComplete="off" />
            </Field>
            <StepNav
              nextStepLabel={tx('Prüfen & Absenden')}
            />
          </div>
        )}

        {/* Schritt 5: Zusammenfassung & Absenden */}
        {step === 5 && !submit.result && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Das Team meldet sich in Kürze per E-Mail und bestätigt deine Mitgliedschaft.')}
            confirmLabel={tx('Jetzt registrieren')}
          />
        )}

        {/* Erfolgsseite */}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[f]}
            next={[{ label: tx('Weitere Person anmelden'), onClick: restart }]}
            whatHappensNext={tx('Du bekommst eine Bestätigung per E-Mail. Das Team vergibt deine Mitgliedsnummer und meldet sich in Kürze.')}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
