import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from './layouts/MainLayout';
import { HomePage } from './pages/HomePage';
import { NewCasePage } from './pages/NewCasePage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { HumanReviewPage } from './pages/HumanReviewPage';
import { VerifyPage } from './pages/VerifyPage';
import { PolicyPage } from './pages/PolicyPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { NotFoundPage } from './pages/NotFoundPage';

const queryClient = new QueryClient();

export const App: React.FC = () => {
  const Router = import.meta.env.BASE_URL === '/' ? BrowserRouter : HashRouter;

  return (
    <QueryClientProvider client={queryClient}>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="cases/new" element={<NewCasePage />} />
            <Route path="cases/:id" element={<CaseDetailPage />} />
            <Route path="human-review" element={<HumanReviewPage />} />
            <Route path="human-review/:id" element={<HumanReviewPage />} />
            <Route path="verify" element={<VerifyPage />} />
            <Route path="policies" element={<PolicyPage />} />
            <Route path="audit-logs" element={<AuditLogPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
};

export default App;
