import React, { Suspense, lazy, useEffect, useState } from 'react';
import { PageSkeleton } from './components/ui/skeleton';
import { Routes, Route, useLocation, Navigate, useParams } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MobileTabBar } from './components/layout/MobileTabBar';
import { OfflineBanner } from './components/layout/OfflineBanner';
import { shouldShowTabBar } from './components/layout/navigation';
import { LoginAdmin } from './pages/LoginAdmin';
import { LoginWorker } from './pages/LoginWorker';
import { ProtectedRoute } from './components/ProtectedRoute';
import { m } from 'framer-motion';
import { transitions } from './components/ui/motion';


/**
 * Loads a page's code only when it's opened. If the file is missing because
 * a new version was deployed while the app was open, reload once to get it.
 */
const RELOAD_FLAG = 'si.chunkReload';
const lazyPage = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() =>
    load()
      .then(mod => {
        try {
          sessionStorage.removeItem(RELOAD_FLAG);
        } catch {
          /* ignore */
        }
        return { default: mod[name] };
      })
      .catch(err => {
        let reloaded = false;
        try {
          reloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
          if (!reloaded) sessionStorage.setItem(RELOAD_FLAG, '1');
        } catch {
          reloaded = true;
        }
        if (!reloaded) window.location.reload();
        throw err;
      }),
  );

const CustomersList = lazyPage(() => import('./pages/CustomersList'), 'CustomersList');
const CustomerProfile = lazyPage(() => import('./pages/CustomerProfile'), 'CustomerProfile');
const JobsList = lazyPage(() => import('./pages/JobsList'), 'JobsList');
const JobDetail = lazyPage(() => import('./pages/JobDetail'), 'JobDetail');
const WorkerJobDetailView = lazyPage(() => import('./pages/jobs/WorkerJobDetailView'), 'WorkerJobDetailView');
const Scheduling = lazyPage(() => import('./pages/Scheduling'), 'Scheduling');
const Employees = lazyPage(() => import('./pages/Employees'), 'Employees');
const Dashboard = lazyPage(() => import('./pages/Dashboard'), 'Dashboard');
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'), 'ResetPassword');
const WorkerDashboard = lazyPage(() => import('./pages/WorkerDashboard'), 'WorkerDashboard');
const EstimatesList = lazyPage(() => import('./pages/EstimatesList'), 'EstimatesList');
const EstimateBuilder = lazyPage(() => import('./pages/EstimateBuilder'), 'EstimateBuilder');
const EstimateDetail = lazyPage(() => import('./pages/EstimateDetail'), 'EstimateDetail');
const InvoicesList = lazyPage(() => import('./pages/InvoicesList'), 'InvoicesList');
const WorkerProfile = lazyPage(() => import('./pages/WorkerProfile'), 'WorkerProfile');
const InvoiceDetail = lazyPage(() => import('./pages/InvoiceDetail'), 'InvoiceDetail');
const InvoiceBuilder = lazyPage(() => import('./pages/InvoiceBuilder'), 'InvoiceBuilder');
const PaymentSuccess = lazyPage(() => import('./pages/PaymentSuccess'), 'PaymentSuccess');
const Expenses = lazyPage(() => import('./pages/Expenses'), 'Expenses');
const NetProfitBreakdown = lazyPage(() => import('./pages/NetProfitBreakdown'), 'NetProfitBreakdown');
const ApproveEstimate = lazyPage(() => import('./pages/ApproveEstimate'), 'ApproveEstimate');
const InternalNotes = lazyPage(() => import('./pages/InternalNotes'), 'InternalNotes');
const Settings = lazyPage(() => import('./pages/Settings'), 'Settings');
const Leads = lazyPage(() => import('./pages/Leads'), 'Leads');
const LeadDetail = lazyPage(() => import('./pages/LeadDetail'), 'LeadDetail');
const NotFound = lazyPage(() => import('./pages/NotFound'), 'NotFound');

/** Pages people open most, fetched quietly once the app is idle so they open instantly. */
const prefetchCommonPages = () => {
  const run = () => {
    import('./pages/Dashboard');
    import('./pages/JobsList');
    import('./pages/jobs/AdminJobDetailView');
    import('./pages/Scheduling');
    import('./pages/Leads');
    import('./pages/WorkerDashboard');
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 4000 });
  else window.setTimeout(run, 2500);
};

const CustomerRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/contacts/${id}`} replace />;
};


// --- Main App Wrapper ---
const App: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  useEffect(() => {
    prefetchCommonPages();
  }, []);
  const isLoginPage = location.pathname.startsWith('/login') || location.pathname === '/reset-password' || location.pathname === '/payment-success' || location.pathname.startsWith('/approve-estimate');

  if (isLoginPage) {
    return (
      <main className="w-full min-h-screen">
        <Suspense fallback={null}>
        <Routes>
          <Route path="/login/admin" element={<LoginAdmin />} />
          <Route path="/login/worker" element={<LoginWorker />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/approve-estimate/:token" element={<ApproveEstimate />} />
        </Routes>
        </Suspense>
      </main>
    );
  }

  const hasTabBar = shouldShowTabBar(location.pathname);

  return (
    <div className="flex w-full min-h-screen bg-canvas">
      {/* Navigation: sidebar on desktop, drawer ("More") on phones */}
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <main className="flex-grow flex flex-col min-w-0 min-h-screen">
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
        <OfflineBanner />

        {/* Opacity only: a transform here would trap fixed pop-ups, toasts and bars inside the page. */}
        <m.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transitions.fast}
          className={`flex-grow flex flex-col overflow-x-hidden ${
            hasTabBar ? 'pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0' : ''
          }`}
        >
          <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
            <Route path="/leads/:id" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
            <Route path="/contacts" element={<ProtectedRoute><CustomersList /></ProtectedRoute>} />
            <Route path="/contacts/:id" element={<ProtectedRoute><CustomerProfile /></ProtectedRoute>} />
            <Route path="/customers" element={<Navigate to="/contacts" replace />} />
            <Route path="/customers/:id" element={<CustomerRedirect />} />
            <Route path="/scheduling" element={<ProtectedRoute><Scheduling /></ProtectedRoute>} />
            <Route path="/jobs" element={<ProtectedRoute><JobsList /></ProtectedRoute>} />
            <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
            <Route path="/worker-jobs/:id" element={<ProtectedRoute><WorkerJobDetailView /></ProtectedRoute>} />
            <Route path="/worker-dashboard" element={<ProtectedRoute><WorkerDashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><WorkerProfile /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
            <Route path="/estimates" element={<ProtectedRoute><EstimatesList /></ProtectedRoute>} />
            <Route path="/estimates/new" element={<ProtectedRoute><EstimateBuilder /></ProtectedRoute>} />
            <Route path="/estimates/:id" element={<ProtectedRoute><EstimateDetail /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><InvoicesList /></ProtectedRoute>} />
            <Route path="/invoices/new" element={<ProtectedRoute><InvoiceBuilder /></ProtectedRoute>} />
            <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceDetail /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
            <Route path="/net-profit-breakdown" element={<ProtectedRoute><NetProfitBreakdown /></ProtectedRoute>} />
            <Route path="/notes" element={<ProtectedRoute><InternalNotes /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
          </Routes>
          </Suspense>
        </m.div>
      </main>

      {/* Phone / tablet bottom tabs */}
      <MobileTabBar onOpenMenu={() => setIsMobileMenuOpen(true)} />
    </div>
  );
};

export default App;
