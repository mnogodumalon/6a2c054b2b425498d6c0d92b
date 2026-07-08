import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import BeitraegeZahlungenPage from '@/pages/BeitraegeZahlungenPage';
import BeitraegeZahlungenDetailPage from '@/pages/BeitraegeZahlungenDetailPage';
import VeranstaltungenPage from '@/pages/VeranstaltungenPage';
import VeranstaltungenDetailPage from '@/pages/VeranstaltungenDetailPage';
import VeranstaltungsteilnahmenPage from '@/pages/VeranstaltungsteilnahmenPage';
import VeranstaltungsteilnahmenDetailPage from '@/pages/VeranstaltungsteilnahmenDetailPage';
import MitgliederPage from '@/pages/MitgliederPage';
import MitgliederDetailPage from '@/pages/MitgliederDetailPage';
import PublicFormBeitraegeZahlungen from '@/pages/public/PublicForm_BeitraegeZahlungen';
import PublicFormVeranstaltungen from '@/pages/public/PublicForm_Veranstaltungen';
import PublicFormVeranstaltungsteilnahmen from '@/pages/public/PublicForm_Veranstaltungsteilnahmen';
import PublicFormMitglieder from '@/pages/public/PublicForm_Mitglieder';
// <public:imports>
// </public:imports>
// <custom:imports>
const VeranstaltungDurchfuehrenPage = lazy(() => import('@/pages/intents/VeranstaltungDurchfuehrenPage'));
const JahresbeitragEinziehenPage = lazy(() => import('@/pages/intents/JahresbeitragEinziehenPage'));
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a2c05202232d348547938ed" element={<PublicFormBeitraegeZahlungen />} />
              <Route path="public/6a2c05219a64afeec0949857" element={<PublicFormVeranstaltungen />} />
              <Route path="public/6a2c05211de15074379308bd" element={<PublicFormVeranstaltungsteilnahmen />} />
              <Route path="public/6a2c051add06b14dff7ae846" element={<PublicFormMitglieder />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="beitraege-zahlungen" element={<BeitraegeZahlungenPage />} />
                <Route path="beitraege-zahlungen/:id" element={<BeitraegeZahlungenDetailPage />} />
                <Route path="veranstaltungen" element={<VeranstaltungenPage />} />
                <Route path="veranstaltungen/:id" element={<VeranstaltungenDetailPage />} />
                <Route path="veranstaltungsteilnahmen" element={<VeranstaltungsteilnahmenPage />} />
                <Route path="veranstaltungsteilnahmen/:id" element={<VeranstaltungsteilnahmenDetailPage />} />
                <Route path="mitglieder" element={<MitgliederPage />} />
                <Route path="mitglieder/:id" element={<MitgliederDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                <Route path="intents/veranstaltung-durchfuehren" element={<Suspense fallback={null}><VeranstaltungDurchfuehrenPage /></Suspense>} />
                <Route path="intents/jahresbeitrag-einziehen" element={<Suspense fallback={null}><JahresbeitragEinziehenPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
