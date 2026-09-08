import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/common/Navbar';
import { LoginPage } from './pages/auth/LoginPage';

// Student Pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { NewGrievancePage } from './pages/student/NewGrievancePage';
import { GrievanceDetailPage } from './pages/student/GrievanceDetailPage';
import { NoticesPage } from './pages/student/NoticesPage';
import { StudentProfilePage } from './pages/student/StudentProfilePage';

// Warden Pages
import { WardenDashboard } from './pages/warden/WardenDashboard';
import { WardenStudentsPage } from './pages/warden/WardenStudentsPage';
import { WardenNoticesPage } from './pages/warden/WardenNoticesPage';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminHostelsPage } from './pages/admin/AdminHostelsPage';
import { AdminAuditLogsPage } from './pages/admin/AdminAuditLogsPage';

import { Building2, Shield, Heart } from 'lucide-react';

export function App() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedGrievanceId, setSelectedGrievanceId] = useState<string | null>(null);

  // Sync default tab when user changes
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') setCurrentTab('admin-dashboard');
      else if (user.role === 'warden') setCurrentTab('warden-dashboard');
      else setCurrentTab('dashboard');
    }
  }, [user?.role]);

  const handleNavigate = (tab: string, grievanceId?: string) => {
    if (grievanceId) {
      setSelectedGrievanceId(grievanceId);
      setCurrentTab('grievance-detail');
    } else {
      setCurrentTab(tab);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center animate-pulse">
            <Building2 className="w-6 h-6 text-indigo-400" />
          </div>
          <span className="text-sm font-semibold tracking-wider text-slate-400">Loading Portal...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Navbar currentTab="login" onNavigate={handleNavigate} />
        <main className="flex-1">
          <LoginPage onLoginSuccess={() => {}} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Dynamic Navigation Bar */}
      <Navbar currentTab={currentTab} onNavigate={handleNavigate} />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {/* Student View Options */}
        {user.role === 'student' && (
          <>
            {(currentTab === 'dashboard' || currentTab === 'grievances') && (
              <StudentDashboard onNavigate={handleNavigate} />
            )}
            {currentTab === 'new-grievance' && (
              <NewGrievancePage
                onBack={() => handleNavigate('dashboard')}
                onCreated={id => handleNavigate('grievance-detail', id)}
              />
            )}
            {currentTab === 'grievance-detail' && selectedGrievanceId && (
              <GrievanceDetailPage
                id={selectedGrievanceId}
                onBack={() => handleNavigate('dashboard')}
              />
            )}
            {currentTab === 'notices' && <NoticesPage />}
            {currentTab === 'profile' && <StudentProfilePage />}
          </>
        )}

        {/* Warden View Options */}
        {user.role === 'warden' && (
          <>
            {(currentTab === 'warden-dashboard' || currentTab === 'warden-grievances') && (
              <WardenDashboard onNavigate={handleNavigate} />
            )}
            {currentTab === 'warden-students' && <WardenStudentsPage />}
            {currentTab === 'warden-notices' && <WardenNoticesPage />}
            {currentTab === 'grievance-detail' && selectedGrievanceId && (
              <GrievanceDetailPage
                id={selectedGrievanceId}
                onBack={() => handleNavigate('warden-dashboard')}
              />
            )}
          </>
        )}

        {/* Admin View Options */}
        {user.role === 'admin' && (
          <>
            {(currentTab === 'admin-dashboard' || currentTab === 'admin-analytics') && (
              <AdminDashboard onNavigate={handleNavigate} />
            )}
            {currentTab === 'admin-users' && <AdminUsersPage />}
            {currentTab === 'admin-hostels' && <AdminHostelsPage />}
            {currentTab === 'admin-audit' && <AdminAuditLogsPage />}
            {currentTab === 'grievance-detail' && selectedGrievanceId && (
              <GrievanceDetailPage
                id={selectedGrievanceId}
                onBack={() => handleNavigate('admin-dashboard')}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 glass-panel py-6 px-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-slate-200">HostelGrievance Redressal</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">
              React 19 • v2.0
            </span>
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            Powered by Next-Gen Campus Redressal Architecture
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button onClick={() => handleNavigate('dashboard')} className="hover:text-white transition-colors">
              Portal
            </button>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
              ● API Online
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
