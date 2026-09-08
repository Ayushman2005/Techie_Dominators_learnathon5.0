import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/apiClient';
import type { Grievance, Notice, GrievanceCategory } from '../../types';
import { GRIEVANCE_CATEGORIES } from '../../types';
import { StatusBadge, PriorityBadge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { CardSkeleton } from '../../components/common/Skeleton';
import {
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  ArrowRight,
  Bell,
  Sparkles,
  Droplets,
  Zap,
  Wifi,
  Home,
  Wrench
} from 'lucide-react';

interface StudentDashboardProps {
  onNavigate: (tab: string, grievanceId?: string) => void;
}

export function StudentDashboard({ onNavigate }: StudentDashboardProps) {
  const { user } = useAuth();
  const { error: toastError } = useToast();

  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [gRes, nRes] = await Promise.all([
        api.getGrievances({ limit: 50 }),
        api.getNotices()
      ]);
      setGrievances(gRes.data || []);
      setNotices(nRes || []);
    } catch (err: any) {
      if (!silent) toastError('Failed to load dashboard', err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Real-time polling every 5 seconds for live status updates
    const timer = setInterval(() => {
      loadData(true);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Filter grievances
  const filteredGrievances = grievances.filter(g => {
    const matchesStatus =
      statusFilter === 'all' ||
      g.status.toLowerCase().replace(' ', '_') === statusFilter;
    const matchesCategory =
      categoryFilter === 'all' || g.category === categoryFilter;
    const matchesSearch =
      !searchQuery ||
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

  // Calculate HUD metrics
  const totalCount = grievances.length;
  const openCount = grievances.filter(g => g.status.toLowerCase() === 'open').length;
  const progressCount = grievances.filter(g => g.status.toLowerCase().includes('progress')).length;
  const resolvedCount = grievances.filter(g => g.status.toLowerCase() === 'resolved').length;

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Water':
        return <Droplets className="w-4 h-4 text-cyan-400" />;
      case 'Electricity':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'Internet':
        return <Wifi className="w-4 h-4 text-indigo-400" />;
      case 'Room':
        return <Home className="w-4 h-4 text-purple-400" />;
      default:
        return <Wrench className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Student Redressal Command Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Welcome back, <span className="gradient-text">{user?.name || 'Student'}</span>
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Room {user?.room || 'N/A'} • Roll {user?.rollNo || 'N/A'} • Track your tickets & live campus notices
            </p>
          </div>

          <button
            onClick={() => onNavigate('new-grievance')}
            className="btn-glow inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-indigo-600/30 shrink-0"
          >
            <Plus className="w-5 h-5" />
            Report New Grievance
          </button>
        </div>

        {/* Ambient background blur inside banner */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Urgent Notice Banner (if any recent notice) */}
      {notices.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900/60 to-purple-950/60 border border-indigo-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-indigo-400 animate-bounce" />
            </div>
            <div className="text-xs sm:text-sm">
              <span className="font-bold text-indigo-300">Notice: </span>
              <span className="text-slate-200 font-medium">{notices[0].title}</span>
              <span className="hidden md:inline text-slate-400 ml-2">— {notices[0].body.slice(0, 80)}...</span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('notices')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold shrink-0 flex items-center gap-1"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metric Cards HUD */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Grievances</span>
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{totalCount}</div>
          <div className="text-[11px] text-slate-500">All filed issues</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-400">{openCount}</div>
          <div className="text-[11px] text-amber-400/80">Awaiting warden assignment</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">In Progress</span>
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <div className="text-3xl font-extrabold text-cyan-400">{progressCount}</div>
          <div className="text-[11px] text-cyan-400/80">Technician active</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400">{resolvedCount}</div>
          <div className="text-[11px] text-emerald-400/80">Successfully closed</div>
        </div>
      </div>

      {/* Filter Bar & Controls */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by ticket ID, title, or keywords..."
              className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
            />
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="glass-input px-3 py-2 rounded-xl text-xs text-slate-200 cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Categories</option>
              {GRIEVANCE_CATEGORIES.map(c => (
                <option key={c} value={c} className="bg-slate-900 text-white">{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
          {[
            { id: 'all', label: 'All Status' },
            { id: 'open', label: 'Open' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'resolved', label: 'Resolved' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grievances List */}
      <div className="space-y-3">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : filteredGrievances.length === 0 ? (
          <EmptyState
            title="No Grievances Found"
            description={
              searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'No issues match your current filters. Try resetting search criteria.'
                : 'You have not reported any issues yet. Submit a grievance whenever you notice hostel defects!'
            }
            actionText="Report Grievance"
            onAction={() => onNavigate('new-grievance')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGrievances.map(item => (
              <div
                key={item.id}
                onClick={() => onNavigate('grievance-detail', item.id)}
                className="glass-panel glass-panel-hover p-5 rounded-2xl border border-white/10 cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-white/5 border border-white/5">
                      {getCategoryIcon(item.category)}
                    </span>
                    <div>
                      <span className="font-mono text-[11px] font-bold text-indigo-400 block">{item.id}</span>
                      <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1">{item.title}</h3>
                    </div>
                  </div>
                  <StatusBadge status={item.status} size="sm" />
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs">
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={item.priority} size="sm" />
                    <span className="text-[11px] text-slate-500 font-medium">
                      {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <span className="text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1 text-[11px]">
                    Track Ticket <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
