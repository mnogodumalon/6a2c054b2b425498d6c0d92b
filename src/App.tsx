import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import MitgliederPage from '@/pages/MitgliederPage';
import BeitraegeZahlungenPage from '@/pages/BeitraegeZahlungenPage';
import VeranstaltungenPage from '@/pages/VeranstaltungenPage';
import VeranstaltungsteilnahmenPage from '@/pages/VeranstaltungsteilnahmenPage';
import PublicFormMitglieder from '@/pages/public/PublicForm_Mitglieder';
import PublicFormBeitraegeZahlungen from '@/pages/public/PublicForm_BeitraegeZahlungen';
import PublicFormVeranstaltungen from '@/pages/public/PublicForm_Veranstaltungen';
import PublicFormVeranstaltungsteilnahmen from '@/pages/public/PublicForm_Veranstaltungsteilnahmen';
// <public:imports>
// </public:imports>
// <custom:imports>
const VeranstaltungsanmeldungPage = lazy(() => import('@/pages/intents/VeranstaltungsanmeldungPage'));
const JahresbeitragErfassenPage = lazy(() => import('@/pages/intents/JahresbeitragErfassenPage'));
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a2c051add06b14dff7ae846" element={<PublicFormMitglieder />} />
              <Route path="public/6a2c05202232d348547938ed" element={<PublicFormBeitraegeZahlungen />} />
              <Route path="public/6a2c05219a64afeec0949857" element={<PublicFormVeranstaltungen />} />
              <Route path="public/6a2c05211de15074379308bd" element={<PublicFormVeranstaltungsteilnahmen />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="mitglieder" element={<MitgliederPage />} />
                <Route path="beitraege-&-zahlungen" element={<BeitraegeZahlungenPage />} />
                <Route path="veranstaltungen" element={<VeranstaltungenPage />} />
                <Route path="veranstaltungsteilnahmen" element={<VeranstaltungsteilnahmenPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                <Route path="intents/veranstaltungsanmeldung" element={<Suspense fallback={null}><VeranstaltungsanmeldungPage /></Suspense>} />
                <Route path="intents/jahresbeitrag-erfassen" element={<Suspense fallback={null}><JahresbeitragErfassenPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
