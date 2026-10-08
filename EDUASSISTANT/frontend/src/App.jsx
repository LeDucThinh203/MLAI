import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppHeader from './components/common/AppHeader';
import TwoFactorModal from './components/modals/TwoFactorModal';
import AuthPage from './pages/auth/AuthPage';
import StudentPortal from './pages/student/StudentPortal';
import ReviewerPortal from './pages/reviewer/ReviewerPortal';
import AdminPortal from './pages/admin/AdminPortal';
import AccountSettingsPortal from './pages/settings/AccountSettingsPortal';
import PublicVerificationPage from './pages/public/PublicVerificationPage';

function MainApp() {
  const { user } = useAuth();
  const [show2FAModal, setShow2FAModal] = useState(false);
  
  const getDefaultTab = (role) => {
    if (role === 'ADMIN') return 'admin_overview';
    if (role === 'REVIEWER') return 'reviewer_queue';
    return 'student_submit';
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab(user?.role));

  useEffect(() => {
    if (user) {
      setActiveTab(getDefaultTab(user.role));
    }
  }, [user]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100%', background: 'transparent' }}>
      <AppHeader activeTab={activeTab} setActiveTab={setActiveTab} onOpen2FAModal={() => setShow2FAModal(true)} />
      
      <main style={{ flex: 1, width: '100%', maxWidth: '100%', margin: '0', padding: '16px 24px', boxSizing: 'border-box' }}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/verify" element={<PublicVerificationPage />} />
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
                      <AdminPortal activeTab={activeTab} setActiveTab={setActiveTab} />
                    )}
                    {user?.role === 'REVIEWER' && (
                      <ReviewerPortal activeTab={activeTab} setActiveTab={setActiveTab} />
                    )}
                    {user?.role === 'STUDENT' && (
                      <StudentPortal activeTab={activeTab} setActiveTab={setActiveTab} />
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
    <AuthProvider>
      <Router>
        <MainApp />
      </Router>
    </AuthProvider>
  );
}