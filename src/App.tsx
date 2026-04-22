import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { JobBoard } from './pages/JobBoard';
import { RoleManagement } from './pages/RoleManagement';
import { OrderForm } from './pages/OrderForm';
import { Login } from './pages/Login';

function PrivateRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />;

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="order" element={<OrderForm />} />
            <Route path="jobs" element={<JobBoard />} />
            <Route path="roles" element={
              <PrivateRoute allowedRoles={['master_admin']}>
                <RoleManagement />
              </PrivateRoute>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
