import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/apiClient';
import type { Notice } from '../../types';
import {
  Building2,
  Bell,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  Plus,
  Menu,
  X,
  Shield,
  GraduationCap,
  ChevronDown,
  LayoutDashboard,
  BarChart3,
  Users,
  Building,
  ShieldCheck,
  Inbox,
  FileText,
  Megaphone,
  Home,
  Activity,
  Zap
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onNavigate: (tab: string, id?: string) => void;
}

export function Navbar({ currentTab, onNavigate }: NavbarProps) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [recentNotices, setRecentNotices] = useState<Notice[]>([]);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const noticesRef = useRef<HTMLDivElement>(null);
  const healthRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (noticesRef.current && !noticesRef.current.contains(e.target as Node)) {
        setNoticesOpen(false);
      }
      if (healthRef.current && !healthRef.current.contains(e.target as Node)) {
        setHealthOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (user) {
      api.getNotices().then(notices => {
        setRecentNotices(notices.slice(0, 5));
      });
    }
  }, [user]);

  // Bespoke navigation items with dedicated Lucide icons
  const roleNavItems = {
    student: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'grievances', label: 'My Grievances', icon: <FileText className="w-4 h-4" /> },
      { id: 'notices', label: 'Notices', icon: <Megaphone className="w-4 h-4" /> },
      { id: 'profile', label: 'Hostel Info', icon: <Home className="w-4 h-4" /> }
    ],
    warden: [
      { id: 'warden-dashboard', label: 'Command Hub', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'warden-grievances', label: 'Grievance Queue', icon: <Inbox className="w-4 h-4" /> },
      { id: 'warden-students', label: 'Hostel Students', icon: <Users className="w-4 h-4" /> },
      { id: 'warden-notices', label: 'Notices Studio', icon: <Megaphone className="w-4 h-4" /> }
    ],
    admin: [
      { id: 'admin-dashboard', label: 'Executive Hub', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'admin-analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
      { id: 'admin-users', label: 'Users', icon: <Users className="w-4 h-4" /> },
      { id: 'admin-hostels', label: 'Hostels', icon: <Building className="w-4 h-4" /> },
      { id: 'admin-audit', label: 'Audit Trail', icon: <ShieldCheck className="w-4 h-4" /> }
    ]
  };

  const navItems = user?.role ? roleNavItems[user.role] : [];

  const roleThemeConfig = {
    student: {
      gradient: 'from-indigo-600 to-cyan-500',
      pill: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      activeTab: 'bg-gradient-to-r from-indigo-500/20 via-indigo-600/30 to-purple-500/20 text-white border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.25)]',
      icon: <GraduationCap className="w-3.5 h-3.5" />,
      label: 'Student'
    },
    warden: {
      gradient: 'from-cyan-600 to-blue-600',
      pill: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      activeTab: 'bg-gradient-to-r from-cyan-500/20 via-blue-600/30 to-indigo-500/20 text-white border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)]',
      icon: <Shield className="w-3.5 h-3.5" />,
      label: 'Warden'
    },
    admin: {
      gradient: 'from-purple-600 to-indigo-600',
      pill: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      activeTab: 'bg-gradient-to-r from-purple-500/20 via-indigo-600/30 to-pink-500/20 text-white border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.25)]',
      icon: <Zap className="w-3.5 h-3.5" />,
      label: 'Super Admin'
    }
  };

  const currentRoleCfg = user?.role ? roleThemeConfig[user.role] : roleThemeConfig.student;

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/[0.08] backdrop-blur-2xl shadow-xl transition-colors">
      {/* Delicate top gradient accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-500/50 via-purple-500/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
          {/* Brand Logo with Ambient Glow */}
          <div
            onClick={() => onNavigate(user?.role === 'admin' ? 'admin-dashboard' : user?.role === 'warden' ? 'warden-dashboard' : 'dashboard')}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${currentRoleCfg.gradient} p-[1.5px] shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/50 transition-all duration-300 group-hover:scale-105`}>
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Building2 className="w-5 h-5 text-indigo-400 group-hover:text-cyan-300 transition-colors" />
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white group-hover:text-slate-100">
                  Hostel<span className="gradient-text">Grievance</span>
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${currentRoleCfg.pill} flex items-center gap-1`}>
                  {currentRoleCfg.icon}
                  {currentRoleCfg.label}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 -mt-0.5">SLA Campus Portal</div>
            </div>
          </div>

          {/* Dynamic Navigation Tabs with Icons & Micro-Pills */}
          {user && (
            <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-md">
              {navItems.map(item => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? `${currentRoleCfg.activeTab} font-bold scale-[1.02]`
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className={`transition-transform duration-200 ${isActive ? 'scale-110 text-indigo-300' : 'text-slate-400'}`}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>

                    {/* Active dynamic indicator dot */}
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Real-time Status Diagnostic Pill */}
            <div className="relative" ref={healthRef}>
              <button
                onClick={() => setHealthOpen(!healthOpen)}
                className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold transition-all group"
                title="Click for system diagnostics"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live Sync</span>
                <ChevronDown className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Health Diagnostics Popover */}
              {healthOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl glass-panel p-4 shadow-2xl border border-white/15 z-50 animate-in fade-in zoom-in-95 text-xs space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-400" /> System Diagnostics
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      100% OPERATIONAL
                    </span>
                  </div>
                  <div className="space-y-1.5 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Backend API:</span>
                      <span className="font-mono font-semibold text-white">127.0.0.1:3001</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Database Engine:</span>
                      <span className="font-mono text-cyan-300 font-semibold">SQLite WAL Mode</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Sync Pipeline:</span>
                      <span className="text-emerald-300 font-semibold">Live Polling (4s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Frontend Engine:</span>
                      <span className="font-mono text-purple-300 font-semibold">React 19 + Vite HMR</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Action Button for Student */}
            {user?.role === 'student' && (
              <button
                onClick={() => onNavigate('new-grievance')}
                className="btn-glow inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/25 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Report Issue</span>
              </button>
            )}

            {/* Notifications Popover Bell */}
            {user && (
              <div className="relative" ref={noticesRef}>
                <button
                  onClick={() => setNoticesOpen(!noticesOpen)}
                  className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
                  aria-label="Notices"
                >
                  <Bell className="w-4 h-4" />
                  {recentNotices.length > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-slate-950 animate-pulse" />
                  )}
                </button>

                {noticesOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl glass-panel p-4 shadow-2xl border border-white/15 z-50 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                      <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <Bell className="w-4 h-4 text-indigo-400" /> Recent Campus Notices
                      </div>
                      <span className="text-[10px] text-indigo-300 font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30">
                        {recentNotices.length} Active
                      </span>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {recentNotices.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">No active campus notices.</p>
                      ) : (
                        recentNotices.map(notice => (
                          <div
                            key={notice.id}
                            onClick={() => {
                              setNoticesOpen(false);
                              onNavigate(user.role === 'admin' ? 'admin-dashboard' : user.role === 'warden' ? 'warden-notices' : 'notices');
                            }}
                            className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors cursor-pointer space-y-1"
                          >
                            <div className="text-xs font-bold text-slate-100 line-clamp-1">{notice.title}</div>
                            <div className="text-[11px] text-slate-400 line-clamp-2">{notice.body}</div>
                            <div className="text-[10px] text-indigo-300/80 font-medium">By {notice.author_name} ({notice.author_role})</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Theme Switcher Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>

            {/* User Profile Avatar Dropdown */}
            {user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 p-1 rounded-xl hover:bg-white/[0.08] border border-white/[0.08] transition-all group"
                >
                  <div className="relative">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${currentRoleCfg.gradient} flex items-center justify-center text-white font-extrabold text-xs shadow-md group-hover:scale-105 transition-transform`}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
                  </div>
                  <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors hidden sm:block mr-1" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-panel p-3 shadow-2xl border border-white/15 z-50 animate-in fade-in zoom-in-95 space-y-1">
                    <div className="px-3 py-2 border-b border-white/10 mb-1">
                      <div className="font-bold text-sm text-slate-100 truncate">{user.name}</div>
                      <div className="text-xs text-slate-400 truncate">{user.email}</div>
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {user.role} {user.room ? `• Room ${user.room}` : ''}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onNavigate(user.role === 'student' ? 'profile' : user.role === 'warden' ? 'warden-dashboard' : 'admin-dashboard');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" /> Account & Hostel Details
                    </button>

                    <button
                      onClick={async () => {
                        setUserDropdownOpen(false);
                        await logout();
                        onNavigate('login');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors text-left font-medium"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 border border-white/10"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Responsive Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden glass-panel border-t border-white/10 px-4 py-4 space-y-2 animate-in slide-in-from-top-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1">
            Menu Navigation
          </div>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                currentTab === item.id
                  ? 'bg-indigo-600/25 text-white border border-indigo-500/40 shadow-sm'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}

          {user && (
            <div className="pt-3 border-t border-white/10 space-y-2">
              <div className="px-3 py-2 flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-xs text-white truncate">{user.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border shrink-0 ${currentRoleCfg.pill}`}>
                  {user.role}
                </span>
              </div>
              <button
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await logout();
                  onNavigate('login');
                }}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors text-left font-medium"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
