import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Mitglieder, BeitraegeZahlungen, Veranstaltungen, Veranstaltungsteilnahmen } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [mitglieder, setMitglieder] = useState<Mitglieder[]>([]);
  const [beitraegeZahlungen, setBeitraegeZahlungen] = useState<BeitraegeZahlungen[]>([]);
  const [veranstaltungen, setVeranstaltungen] = useState<Veranstaltungen[]>([]);
  const [veranstaltungsteilnahmen, setVeranstaltungsteilnahmen] = useState<Veranstaltungsteilnahmen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [mitgliederData, beitraegeZahlungenData, veranstaltungenData, veranstaltungsteilnahmenData] = await Promise.all([
        LivingAppsService.getMitglieder(),
        LivingAppsService.getBeitraegeZahlungen(),
        LivingAppsService.getVeranstaltungen(),
        LivingAppsService.getVeranstaltungsteilnahmen(),
      ]);
      setMitglieder(mitgliederData);
      setBeitraegeZahlungen(beitraegeZahlungenData);
      setVeranstaltungen(veranstaltungenData);
      setVeranstaltungsteilnahmen(veranstaltungsteilnahmenData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [mitgliederData, beitraegeZahlungenData, veranstaltungenData, veranstaltungsteilnahmenData] = await Promise.all([
          LivingAppsService.getMitglieder(),
          LivingAppsService.getBeitraegeZahlungen(),
          LivingAppsService.getVeranstaltungen(),
          LivingAppsService.getVeranstaltungsteilnahmen(),
        ]);
        setMitglieder(mitgliederData);
        setBeitraegeZahlungen(beitraegeZahlungenData);
        setVeranstaltungen(veranstaltungenData);
        setVeranstaltungsteilnahmen(veranstaltungsteilnahmenData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const mitgliederMap = useMemo(() => {
    const m = new Map<string, Mitglieder>();
    mitglieder.forEach(r => m.set(r.record_id, r));
    return m;
  }, [mitglieder]);

  const veranstaltungenMap = useMemo(() => {
    const m = new Map<string, Veranstaltungen>();
    veranstaltungen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [veranstaltungen]);

  return { mitglieder, setMitglieder, beitraegeZahlungen, setBeitraegeZahlungen, veranstaltungen, setVeranstaltungen, veranstaltungsteilnahmen, setVeranstaltungsteilnahmen, loading, error, fetchAll, mitgliederMap, veranstaltungenMap };
}