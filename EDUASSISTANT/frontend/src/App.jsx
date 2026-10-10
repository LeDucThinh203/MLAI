import React, { useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppHeader from './components/common/AppHeader';
import TwoFactorModal from './components/modals/TwoFactorModal';
import AuthPage from './pages/auth/AuthPage';
import StudentPortal from './pages/student/StudentPortal';
import ReviewerPortal from './pages/reviewer/ReviewerPortal';
import AdminPortal from './pages/admin/AdminPortal';
import AccountSettingsPortal from './pages/settings/AccountSettingsPortal';
import PublicVerificationPage from './pages/public/PublicVerificationPage';
import JudgeModePage from './pages/judge/JudgeModePage';

const portalTabsByRole = {
  ADMIN: ['admin_overview', 'admin_users', 'admin_policies', 'admin_sis', 'reviewer_queue', 'reviewer_audit', 'account_settings'],
  REVIEWER: ['reviewer_queue', 'reviewer_audit', 'account_settings'],
  STUDENT: ['student_submit', 'student_cases', 'student_history', 'account_settings']
};

function MainApp() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [show2FAModal, setShow2FAModal] = useState(false);
  
  const getDefaultTab = (role) => {
    if (role === 'ADMIN') return 'admin_overview';
    if (role === 'REVIEWER') return 'reviewer_queue';
    return 'student_submit';
  };

  const [caseToOpen, setCaseToOpen] = useState(null);
  const availableTabs = portalTabsByRole[user?.role] || portalTabsByRole.STUDENT;
  const savedTab = new URLSearchParams(location.search).get('tab');
  const activeTab = availableTabs.includes(savedTab) ? savedTab : getDefaultTab(user?.role);

  const setActiveTab = useCallback((tab) => {
    if (!availableTabs.includes(tab)) return;
    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    navigate({ pathname: '/', search: `?${params.toString()}` });
  }, [availableTabs, location.search, navigate]);

  const handleOpenCase = (caseId) => {
    if (!caseId) return;
    setCaseToOpen(caseId);
    setActiveTab(user?.role === 'STUDENT' ? 'student_cases' : 'reviewer_queue');
  };

  return (
    <div className="app-shell">
      <AppHeader activeTab={activeTab} setActiveTab={setActiveTab} onOpen2FAModal={() => setShow2FAModal(true)} onOpenCase={handleOpenCase} />
      
      <main className="app-main">
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/verify" element={<PublicVerificationPage />} />
          <Route path="/judge" element={<JudgeModePage onNavigateTab={setActiveTab} />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                {activeTab === 'account_settings' ? (
                  <AccountSettingsPortal 
                    onOpen2FAModal={() => setShow2FAModal(true)} 
                    onBack={() => setActiveTab(getDefaultTab(user?.role))}
                  />
                ) : (
                  <>
                    {user?.role === 'ADMIN' && (
                      <AdminPortal activeTab={activeTab} setActiveTab={setActiveTab} caseToOpen={caseToOpen} onCaseOpened={() => setCaseToOpen(null)} />
                    )}
                    {user?.role === 'REVIEWER' && (
                      <ReviewerPortal activeTab={activeTab} setActiveTab={setActiveTab} caseToOpen={caseToOpen} onCaseOpened={() => setCaseToOpen(null)} />
                    )}
                    {(user?.role === 'STUDENT' || (!['ADMIN', 'REVIEWER'].includes(user?.role))) && (
                      <StudentPortal activeTab={activeTab} setActiveTab={setActiveTab} caseToOpen={caseToOpen} onCaseOpened={() => setCaseToOpen(null)} />
                    )}
                  </>
                )}
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Standalone Full-Screen 2FA Modal */}
      <TwoFactorModal
        isOpen={show2FAModal}
        onClose={() => setShow2FAModal(false)}
        user={user}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <MainApp />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
