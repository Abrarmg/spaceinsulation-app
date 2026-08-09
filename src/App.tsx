import React, { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { CustomersList } from './pages/CustomersList';
import { CustomerProfile } from './pages/CustomerProfile';
import { JobsList } from './pages/JobsList';
import { JobDetail } from './pages/JobDetail';
import { Scheduling } from './pages/Scheduling';
import { Employees } from './pages/Employees';
import { Dashboard } from './pages/Dashboard';
import { LoginAdmin } from './pages/LoginAdmin';
import { LoginWorker } from './pages/LoginWorker';
import { ResetPassword } from './pages/ResetPassword';
import { WorkerDashboard } from './pages/WorkerDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { EstimatesList } from './pages/EstimatesList';
import { EstimateBuilder } from './pages/EstimateBuilder';
import { EstimateDetail } from './pages/EstimateDetail';
import { InvoicesList } from './pages/InvoicesList';
import { WorkerProfile } from './pages/WorkerProfile';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { InvoiceBuilder } from './pages/InvoiceBuilder';
import { PaymentSuccess } from './pages/PaymentSuccess';
import { Expenses } from './pages/Expenses';
import { NetProfitBreakdown } from './pages/NetProfitBreakdown';
import { ApproveEstimate } from './pages/ApproveEstimate';


// --- Main App Wrapper ---
const App: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isLoginPage = location.pathname.startsWith('/login') || location.pathname === '/reset-password' || location.pathname === '/payment-success' || location.pathname.startsWith('/approve-estimate');

  if (isLoginPage) {
    return (
      <main className="w-full min-h-screen">
        <Routes>
          <Route path="/login/admin" element={<LoginAdmin />} />
          <Route path="/login/worker" element={<LoginWorker />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/approve-estimate/:token" element={<ApproveEstimate />} />
        </Routes>
      </main>
    );
  }

  return (
    <div className="flex w-full min-h-screen bg-brand-grey">
      {/* Navigation Sidebar */}
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* Main Content Pane */}
      <main className="flex-grow flex flex-col overflow-hidden min-h-screen">
        {/* Global Header Bar */}
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} />

        <div key={location.pathname} className="page-transition flex-grow flex flex-col h-full overflow-y-auto overflow-x-hidden">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><CustomersList /></ProtectedRoute>} />
            <Route path="/customers/:id" element={<ProtectedRoute><CustomerProfile /></ProtectedRoute>} />
            <Route path="/scheduling" element={<ProtectedRoute><Scheduling /></ProtectedRoute>} />
            <Route path="/jobs" element={<ProtectedRoute><JobsList /></ProtectedRoute>} />
            <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
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
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default App;
