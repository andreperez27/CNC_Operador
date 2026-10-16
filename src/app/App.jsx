import { useState, Suspense } from 'react';
import Header from '../components/Header';
import NavTabs from '../components/NavTabs';
import UpdateBanner from '../components/UpdateBanner';
import { AuthProvider } from '../features/auth/AuthContext';
import AuthGate from '../features/auth/AuthGate';
import { lazyWithReload } from './lazyWithReload';
import { isOfflineMode } from './offlineMode';
import styles from './App.module.css';

const RoscasPage = lazyWithReload(() => import('../features/roscas/RoscasPage'));
const TrigonometriaPage = lazyWithReload(() => import('../features/trigonometria/TrigonometriaPage'));
const GCodeRapidoPage = lazyWithReload(() => import('../features/gcoderapido/GCodeRapidoPage'));
const GravadorPage = lazyWithReload(() => import('../features/gravador/GravadorPage'));
const HuronPage = lazyWithReload(() => import('../features/huron/HuronPage'));
const HomePage = lazyWithReload(() => import('../features/home/HomePage'));
const AdminConvitesPage = lazyWithReload(() => import('../features/admin/AdminConvitesPage'));

const PAGES = {
  inicio: HomePage,
  roscas: RoscasPage,
  trigonometria: TrigonometriaPage,
  gcoderapido: GCodeRapidoPage,
  gravador: GravadorPage,
  huron: HuronPage,
  convites: AdminConvitesPage,
};

export default function App() {
  const [activeTab, setActiveTab] = useState('inicio');

  const PageComponent = PAGES[activeTab];
  // Edição offline (pen-drive): sem login, sem banner de update.
  const offline = isOfflineMode();
  const shell = (
    <>
      <NavTabs active={activeTab} onChange={setActiveTab} />
      <main className={styles.main}>
        {PageComponent && (
          <Suspense fallback={<div className={styles.loading}>CARREGANDO...</div>}>
            <PageComponent onNavigate={setActiveTab} />
          </Suspense>
        )}
      </main>
    </>
  );

  return (
    <AuthProvider>
      <div className={styles.app}>
        <Header />
        {offline ? (
          <div className={styles.offlineBadge}>
            Edição offline · v{import.meta.env.VITE_APP_VERSION} · {import.meta.env.VITE_BUILD_DATE}
          </div>
        ) : (
          <UpdateBanner />
        )}
        {offline ? shell : <AuthGate>{shell}</AuthGate>}
      </div>
    </AuthProvider>
  );
}
