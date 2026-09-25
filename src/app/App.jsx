import { useState, lazy, Suspense } from 'react';
import Header from '../components/Header';
import NavTabs from '../components/NavTabs';
import { AuthProvider } from '../features/auth/AuthContext';
import AuthGate from '../features/auth/AuthGate';
import styles from './App.module.css';

const RoscasPage = lazy(() => import('../features/roscas/RoscasPage'));
const TrigonometriaPage = lazy(() => import('../features/trigonometria/TrigonometriaPage'));
const GCodeRapidoPage = lazy(() => import('../features/gcoderapido/GCodeRapidoPage'));
const HuronPage = lazy(() => import('../features/huron/HuronPage'));
const HomePage = lazy(() => import('../features/home/HomePage'));

const PAGES = {
  inicio: HomePage,
  roscas: RoscasPage,
  trigonometria: TrigonometriaPage,
  gcoderapido: GCodeRapidoPage,
  huron: HuronPage,
};

export default function App() {
  const [activeTab, setActiveTab] = useState('inicio');

  const PageComponent = PAGES[activeTab];

  return (
    <AuthProvider>
      <div className={styles.app}>
        <Header />
        <AuthGate>
          <NavTabs active={activeTab} onChange={setActiveTab} />
          <main className={styles.main}>
            {PageComponent && (
              <Suspense fallback={<div className={styles.loading}>CARREGANDO...</div>}>
                <PageComponent onNavigate={setActiveTab} />
              </Suspense>
            )}
          </main>
        </AuthGate>
      </div>
    </AuthProvider>
  );
}
