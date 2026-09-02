import { useMemo, useState } from 'react';
import { format, parseISO, isAfter, isBefore, startOfDay, addDays } from 'date-fns';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { formatDate, formatCurrency, lookupKey } from '@/lib/formatters';
import { LivingAppsService } from '@/services/livingAppsService';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { CalendarWidget, type CalendarEvent } from '@/components/widgets/CalendarWidget';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import {
  IconCalendarEvent,
  IconUsers,
  IconCurrencyEuro,
  IconAlertCircle,
  IconCheck,
  IconClockHour4,
} from '@tabler/icons-react';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    veranstaltungsteilnahmen,
    veranstaltungen,
    mitglieder,
    beitraegeZahlungen,
    veranstaltungenMap,
    mitgliederMap,
    setVeranstaltungen,
    fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'beitraegeZahlungen') {
        const rec = top.record;
        const status = lookupKey(rec.fields.zahlungsstatus);
        if (status === 'offen' || status === 'gemahnt') {
          return {
            label: tx('Als bezahlt markieren'),
            onClick: () => markBezahlt(rec),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedVeranstaltungsteilnahmen = crud.enriched.veranstaltungsteilnahmen;
  const enrichedBeitraegeZahlungen = crud.enriched.beitraegeZahlungen;

  const clock = useClock();
  const today = startOfDay(clock);
  const todayStr = format(today, 'yyyy-MM-dd');
  const in30 = addDays(today, 30);

  // ── Derived data ──────────────────────────────────────────────
  const aktiveMitglieder = useMemo(
    () => mitglieder.filter(m => lookupKey(m.fields.mitgliedsstatus) === 'aktiv'),
    [mitglieder],
  );

  const offeneBeitraege = useMemo(
    () => enrichedBeitraegeZahlungen.filter(b => {
      const s = lookupKey(b.fields.zahlungsstatus);
      return s === 'offen' || s === 'gemahnt';
    }),
    [enrichedBeitraegeZahlungen],
  );

  const gesamtOffenBetrag = useMemo(
    () => offeneBeitraege.reduce((sum, b) => sum + (b.fields.beitragshoehe ?? 0), 0),
    [offeneBeitraege],
  );

  const gemahntePosten = useMemo(
    () => enrichedBeitraegeZahlungen.filter(b => lookupKey(b.fields.zahlungsstatus) === 'gemahnt'),
    [enrichedBeitraegeZahlungen],
  );

  // Upcoming events in the next 30 days
  const kommendeVeranstaltungen = useMemo(
    () => veranstaltungen
      .filter(v => {
        if (!v.fields.datum_uhrzeit) return false;
        const d = parseISO(v.fields.datum_uhrzeit);
        return isAfter(d, today) && isBefore(d, in30);
      })
      .sort((a, b) => (a.fields.datum_uhrzeit ?? '') < (b.fields.datum_uhrzeit ?? '') ? -1 : 1),
    [veranstaltungen, today, in30],
  );

  // Calendar events — Veranstaltungen have a single datetime field (no end)
  const calendarEvents = useMemo<CalendarEvent[]>(
    () => veranstaltungen
      .filter(v => !!v.fields.datum_uhrzeit)
      .map(v => {
        const artKey = lookupKey(v.fields.veranstaltungsart);
        const tone: CalendarEvent['tone'] =
          artKey === 'mitgliederversammlung' ? 'primary'
          : artKey === 'workshop' ? 'success'
          : artKey === 'vortrag' ? 'default'
          : 'default';
        // Count registrations for this event
        const anmeldungen = veranstaltungsteilnahmen.filter(t => {
          const vid = t.fields.veranstaltung?.split('/').pop();
          return vid === v.record_id;
        }).length;
        const subtitle =
          anmeldungen > 0
            ? tx`${anmeldungen} Anmeldung${anmeldungen === 1 ? '' : 'en'}`
            : v.fields.veranstaltungsort ?? undefined;
        return {
          id: `veranstaltungen:${v.record_id}`,
          start: v.fields.datum_uhrzeit!,
          allDay: false,
          title: v.fields.titel ?? tx('Ohne Titel'),
          subtitle,
          tone,
        };
      }),
    [veranstaltungen, veranstaltungsteilnahmen],
  );

  // ── Actions ───────────────────────────────────────────────────
  function markBezahlt(rec: typeof offeneBeitraege[0]) {
    const prev = lookupKey(rec.fields.zahlungsstatus) ?? 'offen';
    // optimistic
    data.setBeitraegeZahlungen(bs =>
      bs.map(b =>
        b.record_id === rec.record_id
          ? { ...b, fields: { ...b.fields, zahlungsstatus: { key: 'bezahlt', label: tx('Bezahlt') } } }
          : b,
      ),
    );
    LivingAppsService.updateBeitraegeZahlungenEntry(rec.record_id, {
      zahlungsstatus: 'bezahlt',
      zahlungsdatum: format(clock, 'yyyy-MM-dd'),
    }).catch(() => fetchAll());
    undoToast(
      tx`${rec.mitgliedName} — Zahlung als bezahlt markiert`,
      () => {
        data.setBeitraegeZahlungen(bs =>
          bs.map(b =>
            b.record_id === rec.record_id
              ? { ...b, fields: { ...b.fields, zahlungsstatus: { key: prev, label: prev } } }
              : b,
          ),
        );
        LivingAppsService.updateBeitraegeZahlungenEntry(rec.record_id, {
          zahlungsstatus: prev,
          zahlungsdatum: undefined,
        }).catch(() => fetchAll());
      },
    );
  }

  // Context line — name upcoming events
  const contextLine = useMemo(() => {
    if (kommendeVeranstaltungen.length === 0 && aktiveMitglieder.length === 0) {
      return tx('Willkommen! Lege jetzt die ersten Mitglieder und Veranstaltungen an.');
    }
    const naechste = kommendeVeranstaltungen[0];
    if (naechste) {
      return tx`Nächste Veranstaltung: ${naechste.fields.titel ?? ''} am ${formatDate(naechste.fields.datum_uhrzeit)}`;
    }
    return tx`${aktiveMitglieder.length} aktive Mitglieder — keine Veranstaltungen in den nächsten 30 Tagen.`;
  }, [kommendeVeranstaltungen, aktiveMitglieder]);

  // ── Hero ──────────────────────────────────────────────────────
  const hero =
    gemahntePosten.length > 0 ? (
      <HeroBanner
        icon={<IconAlertCircle size={18} />}
        action={{
          label: tx('Als bezahlt markieren'),
          onClick: () => markBezahlt(gemahntePosten[0]),
        }}
      >
        <b>{namen(gemahntePosten.map(b => b.mitgliedName))}</b>{' '}
        {tx`— ${gemahntePosten.length} gemahnte Beiträge offen (${formatCurrency(gemahntePosten.reduce((s, b) => s + (b.fields.beitragshoehe ?? 0), 0))})`}
      </HeroBanner>
    ) : undefined;

  // ── KPIs ──────────────────────────────────────────────────────
  const [zahlungsFilter, setZahlungsFilter] = useState<'offen' | null>(null);

  const kpis = (
    <StatStrip>
      <StatStripItem
        title={appLabel('mitglieder')}
        value={aktiveMitglieder.length}
        icon={<IconUsers size={16} />}
        tone="default"
      />
      <StatStripItem
        title={appLabel('veranstaltungen')}
        value={kommendeVeranstaltungen.length}
        icon={<IconCalendarEvent size={16} />}
        tone={kommendeVeranstaltungen.length > 0 ? 'primary' : 'default'}
      />
      <StatStripItem
        title={tx('Offene Beiträge')}
        value={formatCurrency(gesamtOffenBetrag)}
        icon={<IconCurrencyEuro size={16} />}
        tone={offeneBeitraege.length > 0 ? 'warning' : 'default'}
        onClick={() => setZahlungsFilter(f => (f === 'offen' ? null : 'offen'))}
        active={zahlungsFilter === 'offen'}
      />
    </StatStrip>
  );

  // ── Calendar drop ─────────────────────────────────────────────
  const handleEventDrop = async (eventId: string, newStart: string) => {
    const rid = eventId.split(':')[1];
    if (!rid) return;
    const prev = veranstaltungen.find(v => v.record_id === rid);
    if (!prev) return;
    const prevStart = prev.fields.datum_uhrzeit ?? '';
    setVeranstaltungen(vs =>
      vs.map(v =>
        v.record_id === rid ? { ...v, fields: { ...v.fields, datum_uhrzeit: newStart } } : v,
      ),
    );
    try {
      await LivingAppsService.updateVeranstaltungenEntry(rid, { datum_uhrzeit: newStart });
      undoToast(
        tx`${prev.fields.titel ?? ''} — verschoben`,
        () => {
          setVeranstaltungen(vs =>
            vs.map(v =>
              v.record_id === rid ? { ...v, fields: { ...v.fields, datum_uhrzeit: prevStart } } : v,
            ),
          );
          LivingAppsService.updateVeranstaltungenEntry(rid, { datum_uhrzeit: prevStart }).catch(
            () => fetchAll(),
          );
        },
      );
    } catch {
      fetchAll();
    }
  };

  // ── Aside ─────────────────────────────────────────────────────
  const filteredBeitraege = zahlungsFilter
    ? enrichedBeitraegeZahlungen.filter(b => {
        const s = lookupKey(b.fields.zahlungsstatus);
        return s === 'offen' || s === 'gemahnt';
      })
    : offeneBeitraege.slice(0, 8);

  const aside = (
    <>
      <WorkList
        title={tx('Kommende Veranstaltungen')}
        items={kommendeVeranstaltungen.slice(0, 6).map(v => {
          const anmeldungen = veranstaltungsteilnahmen.filter(t => {
            const vid = t.fields.veranstaltung?.split('/').pop();
            return vid === v.record_id;
          }).length;
          const max = v.fields.max_teilnehmer;
          const secondLine = (
            <>
              <span className="text-muted-foreground">
                {formatDate(v.fields.datum_uhrzeit)}
              </span>
              {anmeldungen > 0 && (
                <span className="text-muted-foreground">
                  {' '}·{' '}
                  {anmeldungen}
                  {max ? `/${max}` : ''}{' '}
                  {tx('TN')}
                </span>
              )}
            </>
          );
          return {
            id: v.record_id,
            title: v.fields.titel ?? tx('Ohne Titel'),
            secondLine,
            action: {
              label: tx('Anmeldung'),
              onClick: () => {
                crud.veranstaltungsteilnahmen.openCreate({ veranstaltung: v.record_id });
              },
            },
          };
        })}
        onItemClick={id => {
          const v = veranstaltungen.find(x => x.record_id === id);
          if (v) crud.veranstaltungen.openDetail(v);
        }}
        empty={{
          text: tx('Keine Veranstaltungen in den nächsten 30 Tagen.'),
          action: {
            label: tx('Neue Veranstaltung'),
            onClick: () => crud.veranstaltungen.openCreate({}),
          },
        }}
      />
      <WorkList
        title={tx('Offene Beiträge')}
        items={filteredBeitraege.slice(0, 6).map(b => {
          const statusKey = lookupKey(b.fields.zahlungsstatus) ?? 'offen';
          const secondLine = (
            <>
              <span
                className={
                  statusKey === 'gemahnt'
                    ? 'font-medium text-destructive'
                    : 'text-amber-600 font-medium'
                }
              >
                {b.fields.zahlungsstatus?.label ?? statusKey}
              </span>
              <span className="text-muted-foreground">
                {' '}· {formatCurrency(b.fields.beitragshoehe)}{' '}
                {b.fields.beitragsjahr ? `(${b.fields.beitragsjahr})` : ''}
              </span>
            </>
          );
          return {
            id: b.record_id,
            title: b.mitgliedName || tx('Unbekanntes Mitglied'),
            secondLine,
            action: {
              label: tx('Bezahlt'),
              onClick: () => {
                markBezahlt(b);
              },
            },
          };
        })}
        onItemClick={id => {
          const b = enrichedBeitraegeZahlungen.find(x => x.record_id === id);
          if (b) crud.beitraegeZahlungen.openDetail(b);
        }}
        empty={{
          text: tx('Alle Beiträge bezahlt — super!'),
          action: {
            label: tx('Beitrag erfassen'),
            onClick: () => crud.beitraegeZahlungen.openCreate({}),
          },
        }}
      />
    </>
  );

  // ── Primary: Calendar ─────────────────────────────────────────
  const primary = (
    <CalendarWidget
      events={calendarEvents}
      defaultView="month"
      locale={dateFnsLocale()}
      onEventClick={ev => {
        const rid = ev.id.split(':')[1];
        const v = veranstaltungen.find(x => x.record_id === rid);
        if (v) crud.veranstaltungen.openDetail(v);
      }}
      onEventDrop={handleEventDrop}
      onEmptyClick={date => {
        crud.veranstaltungen.openCreate({
          datum_uhrzeit: format(date, "yyyy-MM-dd'T'HH:mm"),
        });
      }}
    />
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
      </div>

      <DashboardGrid
        variant="wide"
        hero={hero}
        kpis={kpis}
        aside={aside}
        primary={primary}
      />

      {crud.surfaces}
    </div>
  );
}
