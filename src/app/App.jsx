import { useState, lazy, Suspense } from 'react';
import Header from '../components/Header';
import NavTabs from '../components/NavTabs';
import styles from './App.module.css';

const RoscasPage = lazy(() => import('../features/roscas/RoscasPage'));
const TrigonometriaPage = lazy(() => import('../features/trigonometria/TrigonometriaPage'));
const GCodeRapidoPage = lazy(() => import('../features/gcoderapido/GCodeRapidoPage'));

const PAGES = {
  roscas: RoscasPage,
  trigonometria: TrigonometriaPage,
  gcoderapido: GCodeRapidoPage,
};

export default function App() {
  const [activeTab, setActiveTab] = useState('roscas');

  const PageComponent = PAGES[activeTab];

  return (
    <div className={styles.app}>
      <Header />
      <NavTabs active={activeTab} onChange={setActiveTab} />
      <main className={styles.main}>
        {PageComponent && (
          <Suspense fallback={<div className={styles.loading}>CARREGANDO...</div>}>
            <PageComponent />
          </Suspense>
        )}
      </main>
    </div>
  );
}
