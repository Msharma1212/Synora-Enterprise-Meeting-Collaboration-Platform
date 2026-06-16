import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { HistoryPage } from './pages/History';
import { SettingsPage } from './pages/Settings';
import { MeetingRoom } from './pages/MeetingRoom';
import { AdminDashboard } from './pages/AdminDashboard';
import { CommunityPage } from './pages/CommunityPage';
import { Toaster, toast } from 'react-hot-toast';
import api from './services/api';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-white font-black tracking-tighter text-2xl uppercase">Initializing...</div>;
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-white font-black tracking-tighter text-2xl uppercase">Initializing...</div>;
  if (!user || (user.role !== 'admin' && user.role !== 'developer' && user.role !== 'co-admin')) return <Navigate to="/dashboard" />;
  return <Layout>{children}</Layout>;
};

export default function App() {
  React.useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const { data } = await api.get('/health');
        console.log('[System Health Check]:', data);
        if (data.database !== 'connected') {
          toast.error('Database connection issues detected, persistent features may be limited.', {
            id: 'db-health-warn',
            duration: 5000,
            style: { background: '#0f172a', color: '#f87171' }
          });
        }
      } catch (err: any) {
        console.error('[Health check failed]:', err);
        // Silently capture since full dev startup could be still launching or on warm restarts
      }
    };
    checkApiHealth();
  }, []);

  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route 
              path="/dashboard" 
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/history" 
              element={
                <PrivateRoute>
                  <HistoryPage />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <PrivateRoute>
                  <SettingsPage />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/meeting/:code" 
              element={
                <PrivateRoute>
                  <MeetingRoom />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              } 
            />
            <Route path="/community/:username" element={<CommunityPage />} />
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}
