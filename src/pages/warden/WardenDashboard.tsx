import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/apiClient';
import type { Grievance, GrievanceStatus } from '../../types';
import { GRIEVANCE_CATEGORIES } from '../../types';
import { StatusBadge, PriorityBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { CardSkeleton } from '../../components/common/Skeleton';
import {
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  MessageSquare,
  ArrowRight,
  UserCheck,
  Flame,
  ArrowUpDown,
  Send
} from 'lucide-react';

interface WardenDashboardProps {
  onNavigate: (tab: string, grievanceId?: string) => void;
}

export function WardenDashboard({ onNavigate }: WardenDashboardProps) {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Quick Action Modal
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(null);
  const [targetStatus, setTargetStatus] = useState<GrievanceStatus>('In Progress');
  const [remarkText, setRemarkText] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchGrievances = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getGrievances({ limit: 100 });
      setGrievances(res.data || []);
    } catch (err: any) {
      if (!silent) toastError('Failed to load queue', err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrievances();
    // Real-time polling every 4 seconds for instant queue updates
    const timer = setInterval(() => {
      fetchGrievances(true);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleQuickUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGrievance) return;

    setUpdating(true);
    const res = await api.updateStatus(selectedGrievance.id, targetStatus, remarkText || undefined);
    setUpdating(false);

    if (res.ok) {
      success('Ticket Updated', `${selectedGrievance.id} transitioned to ${targetStatus}`);
      setSelectedGrievance(null);
      setRemarkText('');
      fetchGrievances();
    } else {
      toastError('Update Failed', res.error);
    }
  };

  const filtered = grievances.filter(g => {
    const matchStatus = statusFilter === 'all' || g.status.toLowerCase().replace(' ', '_') === statusFilter;
    const matchCategory = categoryFilter === 'all' || g.category === categoryFilter;
    const matchSearch =
      !search ||
      g.title.toLowerCase().includes(search.toLowerCase()) ||
      g.id.toLowerCase().includes(search.toLowerCase()) ||
      (g.student?.name && g.student.name.toLowerCase().includes(search.toLowerCase())) ||
      (g.student?.room && g.student.room.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchCategory && matchSearch;
  });

  // Urgent SLA Queue: Open or In Progress with Urgent/High priority
  const urgentQueue = grievances.filter(
    g => (g.status.toLowerCase() === 'open' || g.status.toLowerCase().includes('progress')) &&
         (g.priority === 'urgent' || g.priority === 'high')
  );

  const totalAssigned = grievances.length;
  const pendingAction = grievances.filter(g => g.status.toLowerCase() === 'open').length;
  const inProgressCount = grievances.filter(g => g.status.toLowerCase().includes('progress')).length;
  const resolvedCount = grievances.filter(g => g.status.toLowerCase() === 'resolved').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-3">
            <Shield className="w-3.5 h-3.5 text-cyan-400" /> Warden Operations & SLA Command Hub
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Hostel Triage Console
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Overseeing assigned hostel block • Rapid status transitions & maintenance dispatch
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('warden-notices')}
            className="btn-glow px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg"
          >
            Broadcast Notice
          </button>
        </div>
      </div>

      {/* KPI HUD Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
          <span className="text-xs font-semibold text-slate-400">Total In Queue</span>
          <div className="text-3xl font-extrabold text-white">{totalAssigned}</div>
          <div className="text-[11px] text-slate-500">Hostel grievances</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
          <span className="text-xs font-semibold text-rose-300 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> Urgent SLA Focus
          </span>
          <div className="text-3xl font-extrabold text-rose-400">{urgentQueue.length}</div>
          <div className="text-[11px] text-rose-400/80">High / Urgent priority</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
          <span className="text-xs font-semibold text-cyan-300">Under Repair</span>
          <div className="text-3xl font-extrabold text-cyan-400">{inProgressCount}</div>
          <div className="text-[11px] text-cyan-400/80">Active work in progress</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
          <span className="text-xs font-semibold text-emerald-300">Resolved Today</span>
          <div className="text-3xl font-extrabold text-emerald-400">{resolvedCount}</div>
          <div className="text-[11px] text-emerald-400/80">Closed tickets</div>
        </div>
      </div>

      {/* Urgent Attention Alert Box */}
      {urgentQueue.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-950/25 border border-rose-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
              Urgent SLA Attention Required ({urgentQueue.length} Tickets)
            </div>
            <span className="text-xs text-rose-400 font-semibold">Priority Triage</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {urgentQueue.slice(0, 3).map(item => (
              <div
                key={item.id}
                onClick={() => onNavigate('grievance-detail', item.id)}
                className="p-3.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/40 border border-rose-500/30 cursor-pointer space-y-1.5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-rose-300">{item.id}</span>
                  <PriorityBadge priority={item.priority} size="sm" />
                </div>
                <div className="text-xs font-bold text-white truncate">{item.title}</div>
                <div className="text-[11px] text-slate-300">
                  {item.student?.name || 'Student'} • Room {item.student?.room || 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queue Filters */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by student name, room, title, or ID..."
              className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
            />
          </div>

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

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
          {[
            { id: 'all', label: 'All Grievances' },
            { id: 'open', label: 'Needs Action (Open)' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'resolved', label: 'Resolved' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Queue Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-6 space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Queue Empty"
              description="No grievances match the specified filter criteria."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Ticket</th>
                  <th className="py-3.5 px-4">Student & Room</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Filed Date</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-indigo-400 block">{item.id}</span>
                      <span className="font-semibold text-white line-clamp-1 max-w-[200px]">{item.title}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">{item.student?.name || 'Student'}</div>
                      <div className="text-[11px] text-slate-400">Room {item.student?.room || 'N/A'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-medium">{item.category}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={item.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={item.priority} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedGrievance(item);
                          setTargetStatus(item.status);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition-colors"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => onNavigate('grievance-detail', item.id)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-semibold transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Action Transition Modal */}
      <Modal
        isOpen={!!selectedGrievance}
        onClose={() => setSelectedGrievance(null)}
        title="Warden Quick Action"
        subtitle={selectedGrievance ? `Transition status for ${selectedGrievance.id}` : ''}
      >
        <form onSubmit={handleQuickUpdateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Set Status</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Open', 'In Progress', 'Resolved'] as const).map(s => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setTargetStatus(s)}
                  className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                    targetStatus === s
                      ? 'bg-cyan-600 border-cyan-500 text-white'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Add Official Remark or Technician Assignment Note
            </label>
            <textarea
              rows={3}
              value={remarkText}
              onChange={e => setRemarkText(e.target.value)}
              placeholder="e.g. Electrician arrived. Repair finished and verified."
              className="w-full px-4 py-2 rounded-xl glass-input text-xs sm:text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setSelectedGrievance(null)}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updating}
              className="btn-glow px-5 py-2 rounded-xl text-xs font-bold"
            >
              {updating ? 'Saving...' : 'Apply Transition'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
